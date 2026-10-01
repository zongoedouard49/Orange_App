import type { NextConfig } from "next";



const nextConfig: NextConfig = {
  reactStrictMode: true,

  allowedDevOrigins: [
    "192.168.137.1",
    "172.20.3.2",
    "localhost",
    "127.0.0.1",
      '172.20.3.128'
  ],
};

export default nextConfig;
