import { MessagesSquare, Plus, RefreshCw, Trash2 } from "lucide-react";

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });

function formatWhen(iso) {
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString() ? timeFmt.format(d) : dateFmt.format(d);
}

/**
 * Past chats list with New chat / Clear history.
 * @param {{ sessions: import("../types.js").ChatSession[], loading: boolean, error: any,
 *   activeId: string | null, onSelect: (id: string) => void, onNewChat: () => void,
 *   onClear: () => void, onRetry: () => void }} props
 */
export default function SessionSidebar({ sessions, loading, error, activeId, onSelect, onNewChat, onClear, onRetry }) {
  return (
    <div className="flex flex-col w-full h-full bg-white">
      <div className="p-3 border-b border-border">
        <button
          type="button"
          onClick={onNewChat}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-green text-white rounded-xl font-medium text-sm hover:bg-dark-green transition-colors"
        >
          <Plus className="w-4 h-4" />
          New chat
        </button>
      </div>

      <nav aria-label="Past chats" className="flex-1 min-h-0 overflow-y-auto p-2">
        {loading && sessions.length === 0 ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-2 border-primary-green border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="p-4 text-center">
            <p className="text-sm text-text-secondary">{error.message}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-primary-green text-primary-green text-xs font-semibold hover:bg-primary-green/10"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
          </div>
        ) : sessions.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-primary-green/10 flex items-center justify-center">
              <MessagesSquare className="w-6 h-6 text-primary-green" />
            </div>
            <p className="text-sm font-medium text-text-primary">No chats yet</p>
            <p className="mt-1 text-xs text-text-secondary">Your questions to MedAssist will appear here.</p>
          </div>
        ) : (
          <ul className="space-y-1">
            {sessions.map((s) => {
              const active = s.id === activeId;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(s.id)}
                    aria-current={active ? "page" : undefined}
                    className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors ${
                      active ? "bg-primary-green/10 text-primary-green" : "text-text-primary hover:bg-gray-100"
                    }`}
                  >
                    <span className="block text-sm font-medium truncate">{s.title}</span>
                    <span className={`block text-[11px] ${active ? "text-primary-green/80" : "text-text-secondary"}`}>
                      {formatWhen(s.updatedAt)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      <div className="p-3 border-t border-border">
        <button
          type="button"
          onClick={onClear}
          disabled={sessions.length === 0}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-medium text-sm hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
        >
          <Trash2 className="w-4 h-4" />
          Clear history
        </button>
      </div>
    </div>
  );
}
