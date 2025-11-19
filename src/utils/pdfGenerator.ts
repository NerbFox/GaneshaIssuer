/**
 * PDF Generator Utility
 * Handles QR code generation, placement on documents, and PDF conversion
 */

import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

export interface QRPosition {
  x: number; // X position as percentage (0-100)
  y: number; // Y position as percentage (0-100)
  size: number; // Size as percentage (0-100)
}

/**
 * Download image from URL as data URI
 * @param url - Image URL
 * @returns Promise with data URI
 */
async function downloadImageAsDataUri(url: string): Promise<string> {
  try {
    console.log('📥 Downloading image from:', url);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }

    const blob = await response.blob();

    // Convert blob to data URI
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('❌ Failed to download image:', error);
    throw error;
  }
}

/**
 * Get image dimensions from data URI
 * @param dataUri - Image data URI
 * @returns Promise with width and height
 */
function getImageDimensions(dataUri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = reject;
    img.src = dataUri;
  });
}

/**
 * Generate QR code as data URI
 * @param vpId - VP ID to encode in QR
 * @param size - QR code size in pixels
 * @returns Promise with data URI
 */
async function generateQRCode(vpId: string, size: number): Promise<string> {
  try {
    console.log('🔷 Generating QR code for VP ID:', vpId);

    const qrContent = {
      type: 'VP_ID',
      vpId: vpId,
    };

    const qrDataUri = await QRCode.toDataURL(JSON.stringify(qrContent), {
      width: size,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    console.log('✅ QR code generated');
    return qrDataUri;
  } catch (error) {
    console.error('❌ Failed to generate QR code:', error);
    throw error;
  }
}

/**
 * Generate PDF with QR code overlay
 * @param backgroundImageUrl - URL of the background image (VC document)
 * @param vpId - VP ID for QR code
 * @param qrPosition - QR position from schema
 * @returns Promise with PDF blob
 */
export async function generatePDFWithQR(
  backgroundImageUrl: string,
  vpId: string,
  qrPosition: QRPosition
): Promise<Blob> {
  try {
    console.log('📝 Starting PDF generation...');
    console.log('Background URL:', backgroundImageUrl);
    console.log('VP ID:', vpId);
    console.log('QR Position:', qrPosition);

    // Step 1: Download background image
    const backgroundDataUri = await downloadImageAsDataUri(backgroundImageUrl);
    console.log('✅ Background image downloaded');

    // Step 2: Get image dimensions
    const { width: imageWidth, height: imageHeight } = await getImageDimensions(backgroundDataUri);
    console.log(`✅ Image dimensions: ${imageWidth}x${imageHeight}`);

    // Step 3: Calculate QR code size and position in pixels
    const qrSize = (qrPosition.size / 100) * Math.min(imageWidth, imageHeight);
    const qrX = (qrPosition.x / 100) * imageWidth;
    const qrY = (qrPosition.y / 100) * imageHeight;

    console.log(`📐 QR Positioning: x=${qrX}px, y=${qrY}px, size=${qrSize}px`);

    // Step 4: Generate QR code
    const qrImageSize = Math.floor(qrSize - 16); // Padding
    const qrDataUri = await generateQRCode(vpId, qrImageSize);

    // Step 5: Create PDF with jsPDF
    console.log('📄 Creating PDF with jsPDF...');

    // Convert px to mm for jsPDF (assuming 96 DPI)
    const pxToMm = (px: number) => (px * 25.4) / 96;

    const pdfWidth = pxToMm(imageWidth);
    const pdfHeight = pxToMm(imageHeight);

    const pdf = new jsPDF({
      orientation: pdfWidth > pdfHeight ? 'landscape' : 'portrait',
      unit: 'mm',
      format: [pdfWidth, pdfHeight],
    });

    // Add background image
    pdf.addImage(backgroundDataUri, 'PNG', 0, 0, pdfWidth, pdfHeight);

    // Add QR code with white background
    const qrPdfX = pxToMm(qrX);
    const qrPdfY = pxToMm(qrY);
    const qrPdfSize = pxToMm(qrSize);
    const qrPdfImageSize = pxToMm(qrImageSize);

    // White background for QR
    pdf.setFillColor(255, 255, 255);
    pdf.rect(qrPdfX, qrPdfY, qrPdfSize, qrPdfSize, 'F');

    // Center QR code image within the white background
    const offsetX = (qrPdfSize - qrPdfImageSize) / 2;
    const offsetY = (qrPdfSize - qrPdfImageSize) / 2;

    // Add QR code image (centered)
    pdf.addImage(
      qrDataUri,
      'PNG',
      qrPdfX + offsetX,
      qrPdfY + offsetY,
      qrPdfImageSize,
      qrPdfImageSize
    );

    console.log('✅ PDF generated successfully');

    // Return as blob
    return pdf.output('blob');
  } catch (error) {
    console.error('❌ PDF generation failed:', error);
    throw error;
  }
}

/**
 * Generate PDF data URL for preview
 * @param backgroundImageUrl - URL of the background image (VC document)
 * @param vpId - VP ID for QR code
 * @param qrPosition - QR position from schema
 * @returns Promise with PDF data URL
 */
export async function generatePDFDataUrl(
  backgroundImageUrl: string,
  vpId: string,
  qrPosition: QRPosition
): Promise<string> {
  const blob = await generatePDFWithQR(backgroundImageUrl, vpId, qrPosition);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Download PDF file
 * @param blob - PDF blob
 * @param filename - Filename for download
 */
export function downloadPDF(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
