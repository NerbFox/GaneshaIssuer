# GaneshaDCERT (GaneshaIssuer)

GaneshaDCERT is a comprehensive Digital Certificate Management System built with Next.js. It provides a complete solution for issuing, managing, and verifying digital credentials using Verifiable Credentials (VC) and Verifiable Presentations (VP) standards.

## 🌟 Features

### For Issuers

- **Issue Request Management**: Handle credential issuance requests
- **Schema Management**: Create and manage credential schemas
- **Issued Credentials**: Track and manage issued credentials
- **History**: View complete history of issued credentials

### For Holders

- **My Credentials**: Manage personal digital credentials
- **Request Credentials**: Request new credentials from issuers
- **VP Request**: Handle Verifiable Presentation requests
- **Credential Operations**: Renew, update, revoke, and upload credentials

### For Verifiers

- **Shared Credentials**: View credentials shared by holders
- **Verify Request**: Create and manage verification requests

### General Features

- **Multi-language Support**: English, Korean, and Indonesian
- **Profile Management**: User profile and account settings
- **Dashboard**: Overview of all activities
- **PDF Generation**: Generate PDF versions of credentials
- **QR Code Support**: Generate and scan QR codes for credentials
- **Secure Authentication**: JWT-based authentication with ES256
- **Decentralized Identifiers (DID)**: Full DID support
- **IndexedDB Storage**: Client-side encrypted storage

## 📋 Minimum System Requirements

### Hardware Requirements

- **CPU**: 2 cores or higher
- **RAM**: 4 GB minimum (8 GB recommended)
- **Storage**: 500 MB free space minimum
- **Network**: Stable internet connection

### Software Requirements

- **Operating System**:
  - macOS 10.15 (Catalina) or later
  - Windows 10/11
  - Linux (Ubuntu 20.04 LTS or equivalent)

## 🛠️ Technology Stack & Versions

### Core Framework

- **Node.js**: v20.x or higher (v20 Alpine used in Docker)
- **Next.js**: v15.5.4
- **React**: v19.1.0
- **TypeScript**: v5.x

### Key Dependencies

- **next-intl**: v3.24.1 (Internationalization)
- **@noble/curves**: v1.4.2 (Cryptographic curves)
- **@noble/hashes**: v1.8.0 (Cryptographic hashing)
- **jspdf**: v3.0.3 (PDF generation)
- **qrcode**: v1.5.4 (QR code generation)
- **html5-qrcode**: v2.3.8 (QR code scanning)
- **Tailwind CSS**: v4 (Styling)

### Development Tools

- **ESLint**: v9.x
- **Prettier**: v3.6.2
- **Jest**: v29.7.0 (Testing)
- **Husky**: v9.1.7 (Git hooks)

## 🚀 Getting Started

### Prerequisites

1. **Install Node.js**

   ```bash
   # Check if Node.js is installed
   node --version  # Should be v20.x or higher
   ```

   If not installed, download from [nodejs.org](https://nodejs.org/)

2. **Install npm** (comes with Node.js)
   ```bash
   npm --version
   ```

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd GaneshaIssuer
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` or `.env.local` file in the root directory with necessary environment variables:

   ```env
   # Add your environment variables here
   # Example:
   # NEXT_PUBLIC_API_URL=https://api.example.com
   # NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

4. **Run the development server**

   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📦 Available Scripts

### Development

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm start            # Start production server
```

### Code Quality

```bash
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint errors automatically
npm run format       # Format code with Prettier
npm run format:check # Check code formatting
```

### Testing

```bash
npm test             # Run tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
```

## 🐳 Docker Deployment

### Using Docker Compose (Recommended)

1. **Build and start the container**

   ```bash
   docker-compose up -d
   ```

2. **Access the application**
   The application will be available at [http://localhost:3070](http://localhost:3070)

3. **Stop the container**
   ```bash
   docker-compose down
   ```

### Manual Docker Build

1. **Build the Docker image**

   ```bash
   docker build -t ganesha-issuer .
   ```

2. **Run the container**
   ```bash
   docker run -p 3000:3000 --env-file .env ganesha-issuer
   ```

### Docker Configuration

- **Production Port**: 3070 (host) → 3000 (container)
- **Base Image**: Node.js 20 Alpine
- **Multi-stage Build**: Optimized for smaller image size
- **Non-root User**: Runs as user `nextjs` for security
- **Health Check**: Automatic health monitoring

## 🌍 Internationalization

The application supports three languages:

- **English** (en) - Default
- **Korean** (ko)
- **Indonesian** (id)

Language is automatically detected from the URL path (e.g., `/en/`, `/ko/`, `/id/`)

## 📂 Project Structure

```
GaneshaIssuer/
├── src/
│   ├── app/              # Next.js app directory
│   │   ├── [locale]/     # Internationalized routes
│   │   │   ├── admin/    # Admin pages
│   │   │   ├── auth/     # Authentication pages
│   │   │   └── institution/ # Main application pages
│   ├── components/       # React components
│   │   ├── holder/       # Holder-specific components
│   │   ├── issuer/       # Issuer-specific components
│   │   └── shared/       # Shared components
│   ├── services/         # API services
│   ├── utils/            # Utility functions
│   ├── locales/          # Translation files
│   └── constants/        # Application constants
├── public/               # Static assets
├── data/                 # JSON data files
└── docker-compose.yml    # Docker configuration
```

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication using ES256 algorithm
- **Encrypted Storage**: Client-side data encryption with AES
- **Seed Phrase Security**: P256 curve-based seed phrase generation
- **DID Support**: Decentralized identifier implementation
- **Verifiable Credentials**: W3C VC standard compliance
- **Secure Key Management**: Private key encryption and storage

## 📝 License

This project is private and proprietary.

---

**Built using Next.js and TypeScript**
