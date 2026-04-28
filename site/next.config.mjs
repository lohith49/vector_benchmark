/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';
// When deployed to GitHub Pages under https://<user>.github.io/<repo>/, set
// BASE_PATH=/<repo> in the deploy workflow. Locally we leave it empty.
const basePath = process.env.BASE_PATH || '';

const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
  basePath,
  assetPrefix: basePath || undefined,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;
