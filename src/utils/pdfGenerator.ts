/**
 * PDF Generator Utility
 * Handles QR code generation, placement on documents, and PDF conversion
 */

import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import Konva from 'konva';

export interface QRPosition {
  x: number; // X position as percentage (0-100)
  y: number; // Y position as percentage (0-100)
  size: number; // Size as percentage (0-100)
}

export interface AttributePosition {
  x: number; // percentage from left (0-100)
  y: number; // percentage from top (0-100)
  width: number; // percentage width (0-100)
  height: number; // percentage height (0-100)
  fontSize: number; // in pixels
  fontFamily?: string; // font family name
  bgColor?: string; // background color (can be 'transparent')
  fontColor?: string; // font color (hex or named)
}

export interface AttributePositionData {
  [attributeName: string]: AttributePosition;
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

/**
 * Map CSS font families to jsPDF built-in fonts
 */
function mapFontFamily(cssFont?: string): { family: string; fallback: boolean } {
  const fontMap: Record<string, string> = {
    Arial: 'helvetica',
    Helvetica: 'helvetica',
    'Times New Roman': 'times',
    Times: 'times',
    'Courier New': 'courier',
    Courier: 'courier',
  };

  const normalized = cssFont || 'Arial';
  const jsPdfFont = fontMap[normalized];

  if (jsPdfFont) {
    return { family: jsPdfFont, fallback: false };
  }

  // Fallback to helvetica for unsupported fonts
  console.warn(`⚠️ Font "${normalized}" not supported, falling back to Helvetica`);
  return { family: 'helvetica', fallback: true };
}

/**
 * Parse hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

/**
 * Generate credential PDF with text attributes directly rendered
 * @param imageUrl - Background credential image URL
 * @param positions - Attribute positions data
 * @param sampleData - Actual attribute values to render
 * @param qrPosition - QR code position (optional)
 * @param vpId - VP ID for QR code (optional, if QR needed)
 * @returns Promise with PDF blob
 */
export async function generateCredentialPDF(
  imageUrl: string,
  positions: AttributePositionData,
  sampleData: Record<string, string>,
  qrPosition?: QRPosition,
  vpId?: string
): Promise<Blob> {
  try {
    console.log('📝 Starting credential PDF generation with jsPDF...');

    // Step 1: Download and load background image
    const backgroundDataUri = await downloadImageAsDataUri(imageUrl);
    const { width: imageWidth, height: imageHeight } = await getImageDimensions(backgroundDataUri);
    console.log(`✅ Image dimensions: ${imageWidth}x${imageHeight}`);

    // Step 2: Initialize jsPDF with image dimensions
    const pxToMm = (px: number) => (px * 25.4) / 96; // Convert pixels to mm (96 DPI)
    const pdfWidth = pxToMm(imageWidth);
    const pdfHeight = pxToMm(imageHeight);

    const pdf = new jsPDF({
      orientation: pdfWidth > pdfHeight ? 'landscape' : 'portrait',
      unit: 'mm',
      format: [pdfWidth, pdfHeight],
    });

    // Step 3: Add background image
    pdf.addImage(backgroundDataUri, 'PNG', 0, 0, pdfWidth, pdfHeight);
    console.log('✅ Background image added');

    // Step 4: Render each attribute
    const attributeNames = Object.keys(positions);
    console.log(`📝 Rendering ${attributeNames.length} attributes...`);

    for (const attrName of attributeNames) {
      const position = positions[attrName];
      const value = sampleData[attrName] || `[${attrName}]`;

      // Convert percentage positions to PDF coordinates (mm)
      const x = (position.x / 100) * pdfWidth;
      const y = (position.y / 100) * pdfHeight;
      const width = (position.width / 100) * pdfWidth;
      const height = (position.height / 100) * pdfHeight;

      // Draw background rectangle if bgColor is specified and not transparent
      if (position.bgColor && position.bgColor !== 'transparent') {
        const bgColor = hexToRgb(position.bgColor);
        pdf.setFillColor(bgColor.r, bgColor.g, bgColor.b);
        pdf.rect(x, y, width, height, 'F');
      }

      // Set text properties
      const fontInfo = mapFontFamily(position.fontFamily);
      pdf.setFont(fontInfo.family, 'normal');

      // Convert px fontSize to PDF points (1px ≈ 0.75pt)
      const fontSizePt = position.fontSize * 0.75;
      pdf.setFontSize(fontSizePt);

      // Set text color
      const textColor = hexToRgb(position.fontColor || '#000000');
      pdf.setTextColor(textColor.r, textColor.g, textColor.b);

      // Calculate text position with padding
      // Add 8px (≈2.12mm) left padding to match pl-2 in CredentialPreview
      const textX = x + pxToMm(8);

      // Position text vertically - align to top with small padding
      // Using fontSize to calculate baseline position
      const textY = y + (fontSizePt / 72) * 25.4; // Convert pt to mm for baseline offset

      // Render text
      pdf.text(value, textX, textY, {
        maxWidth: width - pxToMm(16), // Account for padding on both sides
        baseline: 'top',
      });

      console.log(`✅ Rendered attribute: ${attrName}`);
    }

    // Step 5: Add QR code if provided
    if (qrPosition && vpId) {
      console.log('📐 Adding QR code...');

      const qrSize = (qrPosition.size / 100) * Math.min(imageWidth, imageHeight);
      const qrX = (qrPosition.x / 100) * imageWidth;
      const qrY = (qrPosition.y / 100) * imageHeight;

      // Generate QR code
      const qrImageSize = Math.floor(qrSize - 16);
      const qrDataUri = await generateQRCode(vpId, qrImageSize);

      // Convert to PDF coordinates
      const qrPdfX = pxToMm(qrX);
      const qrPdfY = pxToMm(qrY);
      const qrPdfSize = pxToMm(qrSize);
      const qrPdfImageSize = pxToMm(qrImageSize);

      // White background for QR
      pdf.setFillColor(255, 255, 255);
      pdf.rect(qrPdfX, qrPdfY, qrPdfSize, qrPdfSize, 'F');

      // Center QR code image within white background
      const offsetX = (qrPdfSize - qrPdfImageSize) / 2;
      const offsetY = (qrPdfSize - qrPdfImageSize) / 2;

      pdf.addImage(
        qrDataUri,
        'PNG',
        qrPdfX + offsetX,
        qrPdfY + offsetY,
        qrPdfImageSize,
        qrPdfImageSize
      );

      console.log('✅ QR code added');
    }

    console.log('✅ Credential PDF generated successfully');
    return pdf.output('blob');
  } catch (error) {
    console.error('❌ Credential PDF generation failed:', error);
    throw error;
  }
}

/**
 * Generate credential image directly as PNG (bypassing PDF)
 * @param imageUrl - Background credential image URL
 * @param positions - Attribute positions data
 * @param sampleData - Actual attribute values to render
 * @param qrPosition - QR code position (optional)
 * @param vpId - VP ID for QR code (optional, if QR needed)
 * @returns Promise with PNG blob
 */
export async function generateCredentialImage(
  imageUrl: string,
  positions: AttributePositionData,
  sampleData: Record<string, string>,
  qrPosition?: QRPosition,
  vpId?: string
): Promise<Blob> {
  try {
    console.log('🎨 Starting credential image generation...');

    // Step 1: Download and load background image
    const backgroundDataUri = await downloadImageAsDataUri(imageUrl);
    const { width: imageWidth, height: imageHeight } = await getImageDimensions(backgroundDataUri);
    console.log(`✅ Image dimensions: ${imageWidth}x${imageHeight}`);

    // Step 2: Create canvas with 3x scale for high quality
    const scale = 3;
    const canvas = document.createElement('canvas');
    canvas.width = imageWidth * scale;
    canvas.height = imageHeight * scale;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context');

    // Scale context for high-res rendering
    ctx.scale(scale, scale);

    // Step 3: Draw background image
    const bgImage = new Image();
    await new Promise((resolve, reject) => {
      bgImage.onload = resolve;
      bgImage.onerror = reject;
      bgImage.src = backgroundDataUri;
    });
    ctx.drawImage(bgImage, 0, 0, imageWidth, imageHeight);
    console.log('✅ Background image drawn');

    // Step 4: Render each attribute
    const attributeNames = Object.keys(positions);
    console.log(`📝 Rendering ${attributeNames.length} attributes...`);

    for (const attrName of attributeNames) {
      const position = positions[attrName];
      const value = sampleData[attrName] || `[${attrName}]`;

      // Convert percentage positions to pixel coordinates
      const x = (position.x / 100) * imageWidth;
      const y = (position.y / 100) * imageHeight;
      const width = (position.width / 100) * imageWidth;
      const height = (position.height / 100) * imageHeight;

      // Draw background rectangle if bgColor is specified and not transparent
      if (position.bgColor && position.bgColor !== 'transparent') {
        ctx.fillStyle = position.bgColor;
        ctx.fillRect(x, y, width, height);
      }

      // Set text properties
      const fontFamily = position.fontFamily || 'Arial';
      ctx.font = `${position.fontSize}px ${fontFamily}`;
      ctx.fillStyle = position.fontColor || '#000000';
      ctx.textBaseline = 'top';

      // Draw text with padding (8px left, 2px top to match preview)
      const textX = x + 8;
      const textY = y + 2;

      ctx.fillText(value, textX, textY, width - 16);

      console.log(`✅ Rendered attribute: ${attrName}`);
    }

    // Step 5: Add QR code if provided
    if (qrPosition && vpId) {
      console.log('📐 Adding QR code...');

      const qrSize = (qrPosition.size / 100) * Math.min(imageWidth, imageHeight);
      const qrX = (qrPosition.x / 100) * imageWidth;
      const qrY = (qrPosition.y / 100) * imageHeight;

      // Generate QR code
      const qrImageSize = Math.floor(qrSize - 16);
      const qrDataUri = await generateQRCode(vpId, qrImageSize);

      // Draw white background for QR
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(qrX, qrY, qrSize, qrSize);

      // Load and draw QR code image
      const qrImage = new Image();
      await new Promise((resolve, reject) => {
        qrImage.onload = resolve;
        qrImage.onerror = reject;
        qrImage.src = qrDataUri;
      });

      // Center QR code within white background
      const offsetX = (qrSize - qrImageSize) / 2;
      const offsetY = (qrSize - qrImageSize) / 2;
      ctx.drawImage(qrImage, qrX + offsetX, qrY + offsetY, qrImageSize, qrImageSize);

      console.log('✅ QR code added');
    }

    // Step 6: Convert canvas to PNG blob
    console.log('🖼️ Converting canvas to PNG blob...');
    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to convert canvas to blob'));
      }, 'image/png');
    });

    console.log('✅ Credential image generated successfully');
    return pngBlob;
  } catch (error) {
    console.error('❌ Credential image generation failed:', error);
    throw error;
  }
}

/**
 * Generate credential image using Konva.js (consistent rendering across all contexts)
 * @param imageUrl - Background credential image URL
 * @param positions - Attribute positions data
 * @param sampleData - Actual attribute values to render
 * @param qrPosition - QR code position (optional)
 * @param vpId - VP ID for QR code (optional, if QR needed)
 * @returns Promise with PNG blob
 */
export async function generateCredentialImageKonva(
  imageUrl: string,
  positions: AttributePositionData,
  sampleData: Record<string, string>,
  qrPosition?: QRPosition,
  vpId?: string
): Promise<Blob> {
  try {
    console.log('🎨 Starting Konva credential image generation...');

    // Step 1: Load background image
    const backgroundImage = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.crossOrigin = 'anonymous';
      img.src = imageUrl;
    });

    const imageWidth = backgroundImage.naturalWidth;
    const imageHeight = backgroundImage.naturalHeight;
    console.log(`✅ Image loaded: ${imageWidth}x${imageHeight}`);

    // Step 2: Create offscreen Konva stage
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    document.body.appendChild(container);

    const stage = new Konva.Stage({
      container: container,
      width: imageWidth,
      height: imageHeight,
      pixelRatio: 1, // Match original image resolution
    });

    // Step 3: Add background layer
    const backgroundLayer = new Konva.Layer();
    const bgKonvaImage = new Konva.Image({
      x: 0,
      y: 0,
      image: backgroundImage,
      width: imageWidth,
      height: imageHeight,
    });
    backgroundLayer.add(bgKonvaImage);
    stage.add(backgroundLayer);
    console.log('✅ Background layer added');

    // Step 4: Add text layer
    const textLayer = new Konva.Layer();
    const attributeNames = Object.keys(positions);
    console.log(`📝 Rendering ${attributeNames.length} attributes with Konva...`);

    for (const attrName of attributeNames) {
      const position = positions[attrName];
      const value = sampleData[attrName] || `[${attrName}]`;

      // Convert percentage positions to pixel coordinates
      const x = (position.x / 100) * imageWidth;
      const y = (position.y / 100) * imageHeight;
      const width = (position.width / 100) * imageWidth;
      const height = (position.height / 100) * imageHeight;

      // Draw background rectangle if bgColor is specified and not transparent
      if (position.bgColor && position.bgColor !== 'transparent') {
        const bgRect = new Konva.Rect({
          x,
          y,
          width,
          height,
          fill: position.bgColor,
        });
        textLayer.add(bgRect);
      }

      // Add text element with padding (8px left, 2px top)
      const text = new Konva.Text({
        x: x + 8,
        y: y + 2,
        text: value,
        fontSize: position.fontSize,
        fontFamily: position.fontFamily || 'Arial',
        fill: position.fontColor || '#000000',
        width: width - 16, // Account for left + right padding
        align: 'left',
        verticalAlign: 'top',
        ellipsis: true,
        wrap: 'none',
      });
      textLayer.add(text);

      console.log(`✅ Rendered attribute: ${attrName}`);
    }

    stage.add(textLayer);

    // Step 5: Add QR code layer if provided
    if (qrPosition && vpId) {
      console.log('📐 Adding QR code with Konva...');

      const qrLayer = new Konva.Layer();
      const qrSize = (qrPosition.size / 100) * Math.min(imageWidth, imageHeight);
      const qrX = (qrPosition.x / 100) * imageWidth;
      const qrY = (qrPosition.y / 100) * imageHeight;

      // White background for QR
      const qrBg = new Konva.Rect({
        x: qrX,
        y: qrY,
        width: qrSize,
        height: qrSize,
        fill: '#FFFFFF',
      });
      qrLayer.add(qrBg);

      // Generate QR code image
      const qrImageSize = Math.floor(qrSize - 16);
      const qrDataUri = await generateQRCode(vpId, qrImageSize);
      const qrImage = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = qrDataUri;
      });

      // Center QR code within white background
      const offsetX = (qrSize - qrImageSize) / 2;
      const offsetY = (qrSize - qrImageSize) / 2;

      const qrKonvaImage = new Konva.Image({
        x: qrX + offsetX,
        y: qrY + offsetY,
        image: qrImage,
        width: qrImageSize,
        height: qrImageSize,
      });
      qrLayer.add(qrKonvaImage);
      stage.add(qrLayer);

      console.log('✅ QR code added');
    }

    // Step 6: Export to PNG blob
    console.log('🖼️ Exporting Konva stage to PNG...');
    const dataUrl = stage.toDataURL({
      pixelRatio: 1,
      mimeType: 'image/png',
    });

    // Convert data URL to Blob
    const pngBlob = await fetch(dataUrl).then((r) => r.blob());

    // Cleanup
    stage.destroy();
    document.body.removeChild(container);

    console.log('✅ Konva credential image generated successfully');
    return pngBlob;
  } catch (error) {
    console.error('❌ Konva credential image generation failed:', error);
    throw error;
  }
}

/**
 * Convert PDF blob to PNG image blob using PDF.js (kept for backward compatibility)
 * @param pdfBlob - PDF blob to convert
 * @param scale - Scale factor for resolution (default: 3 for high quality)
 * @returns Promise with PNG blob
 */
export async function convertPDFToPNG(pdfBlob: Blob, scale: number = 3): Promise<Blob> {
  try {
    console.log('🖼️ Converting PDF to PNG...');

    // Create object URL for PDF
    const pdfUrl = URL.createObjectURL(pdfBlob);

    try {
      // Load PDF using PDF.js (dynamically import)
      const pdfjsLib = await import('pdfjs-dist');

      // Set worker source - try local first, fallback to CDN
      try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.mjs',
          import.meta.url
        ).toString();
      } catch {
        // Fallback to CDN
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
      }

      console.log('📚 Loading PDF document...');
      const loadingTask = pdfjsLib.getDocument(pdfUrl);
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(1);

      // Get viewport at desired scale
      const viewport = page.getViewport({ scale });
      console.log(`📐 Viewport: ${viewport.width}x${viewport.height}`);

      // Create canvas
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Failed to get canvas context');

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      console.log('🎨 Rendering PDF to canvas...');
      // Render PDF page to canvas
      await page.render({
        canvasContext: context,
        viewport: viewport,
        canvas: canvas,
      }).promise;

      console.log('🖼️ Converting canvas to PNG blob...');
      // Convert canvas to PNG blob
      const pngBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to convert canvas to blob'));
        }, 'image/png');
      });

      // Cleanup
      URL.revokeObjectURL(pdfUrl);

      console.log('✅ PDF converted to PNG successfully');
      return pngBlob;
    } catch (pdfjsError) {
      console.error('⚠️ PDF.js conversion failed, trying alternative method:', pdfjsError);

      // Fallback: Use an image element to render the PDF
      // This works in some browsers that can display PDFs directly
      throw new Error('PDF.js conversion failed. Please check console for details: ' + pdfjsError);
    }
  } catch (error) {
    console.error('❌ PDF to PNG conversion failed:', error);
    throw error;
  }
}
