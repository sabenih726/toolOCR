/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // Untuk static export jika diperlukan
  images: {
    unoptimized: true
  }
}

module.exports = nextConfig