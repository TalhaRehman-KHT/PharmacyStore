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
                {/* Sign-in Button (top-right on large screens) */}
                <div className="absolute top-6 right-6 md:block hidden">
                    <Link to="/login" className="signin">
                        Sign in
                    </Link>
                </div>

                {/* Sign-in Button (center top on small screens) */}
                <div className="md:hidden mb-6">
                    <Link to="/login" className="signin">
                        Sign in
                    </Link>
                </div>

                {/* Centered Content */}
                <div className="flex flex-col justify-center items-center w-full max-w-sm">
                    <h3 className="text-2xl font-semibold mb-2">
                        Sign Up to Pharmacy Store
                    </h3>
                    <span className="text-gray-600 mb-8 text-sm md:text-base">
                        How do you want to join our wide community?
                    </span>

                    {/* Join as Vendor */}
                    <Link
                        to="/register?role=vendor"
                        className="w-full py-4 mb-4 rounded-lg border border-gray-300 hover:bg-gray-100 hover:border-green-400 font-semibold transition block"
                    >
                        Join as Vendor
                    </Link>

                    {/* Join as User */}
                    <Link
                        to="/register?role=user"
                        className="w-full py-4 rounded-lg border border-gray-300 hover:bg-gray-100 hover:border-green-400 font-semibold transition block"
                    >
                        Join as User
                    </Link>
                </div>
            </div>
        </div>
    );
}
