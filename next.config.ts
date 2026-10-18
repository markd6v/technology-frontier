import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // content/*.yaml is read with fs at runtime; make sure it ships with every function.
  outputFileTracingIncludes: { "/**": ["./content/**"] },
  async headers() {
    // Public but not a news site to be indexed (REQUIREMENTS §2).
    return [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }];
  },
};

export default nextConfig;
