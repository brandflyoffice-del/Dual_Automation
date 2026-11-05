import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
  // pdfkit reads its font metrics from node_modules at run time; bundling it breaks that.
  serverExternalPackages: ["pdfkit", "imapflow", "mailparser", "nodemailer"],
};

export default nextConfig;
