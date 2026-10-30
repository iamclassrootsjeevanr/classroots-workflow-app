import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['exceljs', 'nodemailer'],
  poweredByHeader: false,
};

export default nextConfig;
