import React from "react";
import { Link } from "react-router-dom";
import "./Start.css";

export default function Start() {
    return (
        <div className="flex flex-col md:flex-row min-h-screen">
            {/* Left Image Section */}
            <div className="hidden md:block md:w-1/2">
                <img
                    src="/assets/pharmacyDIVpic.jpg"
                    alt="Pharmacy"
                    className="w-full h-full object-cover"
                />
            </div>

            {/* Right Content Section */}
            <div className="contentSection">
                {/* Centered Content */}
                <div className="flex flex-col justify-center items-center w-full max-w-sm">
                    <h3 className="text-2xl font-semibold mb-2">
                        Pharmacy Store
                    </h3>
                    <span className="text-gray-600 mb-8 text-sm md:text-base">
                        How do you want to join our wide community?
                    </span>

                    {/* Vendor: Join */}
                    <Link
                        to="/vendor/register"
                        className="w-full py-3 mb-4 rounded-lg bg-green-600 text-white hover:bg-green-700 font-medium transition block text-center"
                    >
                        Join as Vendor
                    </Link>

                    {/* User: Join */}
                    <Link
                        to="/user/register"
                        className="w-full py-3 rounded-lg bg-green-600 text-white hover:bg-green-700 font-medium transition block text-center"
                    >
                        Join as Customer
                    </Link>
                </div>
            </div>
        </div>
    );
}
