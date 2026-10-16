# MedAssist API deployment (AWS)

Plan from the PR-11 audit. Region `ap-southeast-2`, cluster `pharmacy-store-cluster` (both already exist).
Names below are fixed; later steps (PR-12 image, PR-13 workflow, PR-14 Client + CORS) use them.

## Topology (recommended)
```
Browser (https Client page)
  -> CloudFront  medassist-api-cf   (HTTPS, cache disabled, behaviour /medassist/*)
  -> existing ALB, HTTP :80 listener rule  path /medassist/*
  -> target group medassist-api-tg  (IP, :8000, health /medassist/health)
  -> ECS Fargate service medassist-api-service (1 task, in pharmacy-store-cluster)
  -> Supabase / Groq / Gemini over 443
```
Why:
- Shares the cluster and the load balancer: no new ALB (a new one is about US$20/month before traffic).
- `API_PREFIX=/medassist` lets one ALB route by path, next to the Client (`/`) and Server (`/api/*`).
- HTTPS option (a) CloudFront: an https page cannot call a plain-http API (mixed content), and the repo has no
  domain. CloudFront gives `https://dxxxx.cloudfront.net` + a free certificate. Option (b) (HTTPS listener + ACM
  certificate) needs a domain you own; switch later if you buy one.
- Secrets live in SSM Parameter Store (SecureString) and reach the task as env vars at start. Never in the image,
  never in GitHub (unlike the Server's baked `.env`).
- SSE: CloudFront and the ALB close a connection that is silent for 60 s. sse-starlette sends a ping every 15 s,
  so a long answer stays open. **Test streaming through the public CloudFront URL**, not only localhost.

## Cost note (approx., Sydney, check the AWS Pricing Calculator)
| item | per month |
|---|---|
| Fargate 0.5 vCPU / 1 GB, 1 task 24/7 | ~US$22 |
| public IPv4 on the task (only if `assignPublicIp=ENABLED`) | ~US$3.6 |
| shared ALB: extra LCU only | < US$1 |
| CloudFront (free tier 1 TB + 10M requests) | ~0 |
| ECR image (~0.5 GB) / CloudWatch logs (small) / SSM standard params | < US$1 / < US$1 / 0 |
Scale the service to 0 tasks when not demoing to stop the Fargate cost.

## 0. Confirm first (console, read only)
- [ ] EC2 > Load Balancers: an ALB serves the Client/Server services? Note its name, its security group, and
      its HTTP :80 listener. **No ALB = stop and tell Claude** (then a new ALB is needed, ~US$20/month).
- [ ] The Client's public URL (http or https?) = the exact value for `CORS_ORIGINS`.
- [ ] VPC + subnets used by the existing services (reuse them).

## 1. ECR
- [ ] Repository `medassist-api` (private, tag mutability: mutable, scan on push: on).
- [ ] Lifecycle rule: keep the last 10 images.

## 2. SSM Parameter Store (SecureString, KMS key `alias/aws/ssm`)
- [ ] `/medassist/prod/SUPABASE_URL`
- [ ] `/medassist/prod/SUPABASE_SERVICE_KEY`
- [ ] `/medassist/prod/GROQ_API_KEY`
- [ ] `/medassist/prod/GEMINI_API_KEY`
- [ ] `/medassist/prod/LANGSMITH_API_KEY` (optional)
Not needed at runtime: `DATABASE_URL`, `SUPABASE_ANON_KEY`, `OPENFDA_API_KEY`, `SUPABASE_JWT_SECRET` (app_user_id mode).

## 3. CloudWatch Logs
- [ ] Log group `/ecs/medassist-api`, retention 14 days.

## 4. IAM
- [ ] Role `medassist-api-exec-role` (trusted entity: Elastic Container Service Task):
      managed `AmazonECSTaskExecutionRolePolicy` + inline `ssm:GetParameters` on
      `arn:aws:ssm:ap-southeast-2:<account>:parameter/medassist/prod/*` (+ `kms:Decrypt` only if a custom KMS key).
- [ ] Role `medassist-api-task-role` (same trust, no policies: the app calls no AWS API).
- [ ] CI user (the one behind `AWS_ACCESS_KEY_ID`), add inline policy `medassist-api-deploy`:
      `ecr:GetAuthorizationToken` (`*`); `ecr:BatchCheckLayerAvailability`, `ecr:InitiateLayerUpload`,
      `ecr:UploadLayerPart`, `ecr:CompleteLayerUpload`, `ecr:PutImage`, `ecr:BatchGetImage` on repo `medassist-api`;
      `ecs:DescribeTaskDefinition`, `ecs:RegisterTaskDefinition` (`*`); `ecs:UpdateService`, `ecs:DescribeServices`
      on service `medassist-api-service`; `iam:PassRole` on the two roles above.

## 5. Security group
- [ ] `medassist-api-sg` (same VPC): inbound TCP 8000 from the ALB's security group only; outbound all.

## 6. Target group + listener rule
- [ ] Target group `medassist-api-tg`: type IP, HTTP, port 8000, same VPC; health check `/medassist/health`,
      success 200, interval 30 s, healthy 2, unhealthy 3; deregistration delay 30 s.
- [ ] Existing ALB, HTTP :80 listener: rule `Path = /medassist/*` -> forward `medassist-api-tg`, priority 10
      (before any catch-all). ALB idle timeout stays 60 s (pings keep SSE alive).

## 7. ECS task definition + service (PR-12/13 add `deploy/task-definition.json`; first time by hand)
- [ ] Family `medassist-api`, Fargate, Linux/X86_64, 0.5 vCPU, 1 GB; exec role + task role from step 4.
- [ ] Container `medassist-api`, image `<account>.dkr.ecr.ap-southeast-2.amazonaws.com/medassist-api:latest`,
      port 8000, logs awslogs -> `/ecs/medassist-api`, prefix `medassist`.
- [ ] Secrets (valueFrom SSM): the 4-5 names from step 2.
- [ ] Env: `APP_ENV=prod`, `API_PREFIX=/medassist`, `CORS_ORIGINS=["https://<client origin>"]`,
      `AUTH_MODE=app_user_id`, `FORWARDED_ALLOW_IPS=*` (only the ALB can reach the task: step 5),
      `LOG_LEVEL=INFO`, `ENABLE_DOCS=false`, `RERANK_ENABLED=false`. Other settings keep their defaults.
- [ ] Container health check: `CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/medassist/health')"`.
- [ ] Service `medassist-api-service` in `pharmacy-store-cluster`: desired 1, existing subnets, SG `medassist-api-sg`,
      load balancer -> `medassist-api-tg` (container `medassist-api:8000`), health grace 60 s, rolling update
      min 100 % / max 200 %, deployment circuit breaker with rollback on.

## 8. CloudFront `medassist-api-cf`
- [ ] Origin: the ALB DNS name, protocol HTTP only, port 80, response timeout 60 s, keep-alive 5 s.
- [ ] Default behaviour (and `/medassist/*`): viewer protocol "Redirect HTTP to HTTPS"; allowed methods
      GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE; cache policy `Managed-CachingDisabled`;
      origin request policy `Managed-AllViewerExceptHostHeader` (forwards `X-User-Id`, `Content-Type`, `Origin`,
      query strings); compression off (CachingDisabled has none, so SSE is not buffered).
- [ ] Price class: "Use all edge locations" or "North America, Europe, Asia ..." (both OK); no WAF (cost).
- [ ] Result: `https://<dxxxx>.cloudfront.net/medassist/health` returns 200.

## 9. GitHub (Settings > Secrets and variables > Actions), names only
| kind | name | status |
|---|---|---|
| secret | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | exist, reused (CI user gets step 4 policy) |
| variable | `VITE_MEDASSIST_API_URL` = `https://<dxxxx>.cloudfront.net/medassist` | new, used by the one Client line (PR-14) |
| environment | `production` (manual approval) | exists, reused by the MedAssist deploy job |
Fixed names (ECR repo, cluster, service, task family, container) go into the new workflow's `env:` block, like
the existing workflow. No runtime secret goes into GitHub (they are in SSM).

## 10. Verify after the first deploy (PR-15)
- [ ] `/medassist/health` and `/medassist/ready` = 200 through CloudFront.
- [ ] Browser on the live Client: login, ask one question, tokens arrive one by one (SSE), no CORS error.
- [ ] Vendor: escalations page loads. CloudWatch log lines are JSON and contain no question text.
