import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system';
import { COLORS, SPACING, RADIUS, SHADOWS, OVERLAYS } from '@/constants/theme';
import { bodyText, FONT } from '@/constants/typography';

type Props = {
  pdfUri: string;
  onImageGenerated: (imageUri: string) => void;
  onMultiPageGenerated?: (imageUris: string[]) => void;
  onError: (error: string) => void;
  onCancel: () => void;
  autoProcess?: boolean; // If true, automatically process based on page count
};

export default function PDFToImageConverter({ 
  pdfUri, 
  onImageGenerated, 
  onMultiPageGenerated,
  onError, 
  onCancel,
  autoProcess = false
}: Props) {
  const [isConverting, setIsConverting] = useState(false);
  const [selectedPage, setSelectedPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pdfData, setPdfData] = useState<string | null>(null);
  const [isLoadingPDF, setIsLoadingPDF] = useState(true);
  const [isExtractingAllPages, setIsExtractingAllPages] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState(0);
  const webViewRef = useRef<WebView>(null);

  // Convert local PDF file to base64 data URL
  useEffect(() => {
    const loadPDFAsBase64 = async () => {
      try {
        console.log('Loading PDF from:', pdfUri);
        setIsLoadingPDF(true);
        
        // Read the PDF file as base64
        const base64Data = await FileSystem.readAsStringAsync(pdfUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        // Create data URL
        const dataUrl = `data:application/pdf;base64,${base64Data}`;
        setPdfData(dataUrl);
        
        console.log('PDF loaded successfully, size:', base64Data.length);
      } catch (error) {
        console.error('Error loading PDF:', error);
        onError('Failed to load PDF file. Please try again.');
      } finally {
        setIsLoadingPDF(false);
      }
    };

    if (pdfUri) {
      loadPDFAsBase64();
    }
  }, [pdfUri, onError]);

  const generatePDFToImageHTML = (pdfDataUrl: string) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
      <style>
        * {
          box-sizing: border-box;
        }
        
        body {
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
          background: #eeece5;
          color: #27241F;
          line-height: 1.5;
        }
        
        .app-container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }
        
        .header {
          background: #FFFFFF;
          padding: 20px;
          border-bottom: 1px solid #e6e0d9;
          box-shadow: 0 2px 4px rgba(39, 36, 31, 0.05);
        }
        
        .header-title {
          font-size: 20px;
          font-weight: 600;
          color: #27241F;
          margin: 0 0 4px 0;
          font-family: 'Ubuntu', sans-serif;
        }
        
        .header-subtitle {
          font-size: 14px;
          color: #5C6B73;
          margin: 0;
          font-family: 'Inter', sans-serif;
        }
        
        .content {
          flex: 1;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        
        .controls {
          background: #FFFFFF;
          border-radius: 12px;
          padding: 16px;
          box-shadow: 0 2px 4px rgba(39, 36, 31, 0.05);
          border: 1px solid #e6e0d9;
        }
        
        .navigation {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          gap: 12px;
        }
        
        .page-nav {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
        }
        
        .nav-button {
          background: #109DF0;
          color: #FFFFFF;
          border: none;
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
          transition: all 0.2s ease;
          min-width: 60px;
        }
        
        .nav-button:hover {
          background: #0b8ad8;
          transform: translateY(-1px);
        }
        
        .nav-button:disabled {
          background: #cccccc;
          cursor: not-allowed;
          transform: none;
        }
        
        .page-info {
          font-size: 14px;
          color: #5C6B73;
          font-weight: 500;
          font-family: 'Inter', sans-serif;
          white-space: nowrap;
        }
        
        .action-buttons {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        
        .action-btn {
          padding: 10px 16px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
          transition: all 0.2s ease;
          flex: 1;
          min-width: 100px;
        }
        
        .action-btn:hover {
          transform: translateY(-1px);
        }
        
        .btn-primary {
          background: #109DF0;
          color: #FFFFFF;
        }
        
        .btn-primary:hover {
          background: #0b8ad8;
        }
        
        .btn-secondary {
          background: #9253E0;
          color: #FFFFFF;
        }
        
        .btn-secondary:hover {
          background: #7a3fc7;
        }
        
        .btn-danger {
          background: #D32F2F;
          color: #FFFFFF;
        }
        
        .btn-danger:hover {
          background: #b71c1c;
        }
        
        .pdf-container {
          background: #FFFFFF;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 2px 4px rgba(39, 36, 31, 0.05);
          border: 1px solid #e6e0d9;
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 400px;
        }
        
        #pdfCanvas {
          max-width: 100%;
          max-height: 100%;
          border-radius: 8px;
          box-shadow: 0 4px 8px rgba(39, 36, 31, 0.1);
          border: 1px solid #e6e0d9;
        }
        
        .loading {
          text-align: center;
          padding: 40px;
          color: #5C6B73;
          font-family: 'Inter', sans-serif;
        }
        
        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #e6e0d9;
          border-top: 3px solid #109DF0;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 16px;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .progress-container {
          background: #FFFFFF;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 2px 4px rgba(39, 36, 31, 0.05);
          border: 1px solid #e6e0d9;
          margin-top: 16px;
        }
        
        .progress-bar {
          width: 100%;
          height: 8px;
          background: #e6e0d9;
          border-radius: 4px;
          overflow: hidden;
          margin: 12px 0;
        }
        
        .progress-fill {
          height: 100%;
          background: #109DF0;
          border-radius: 4px;
          transition: width 0.3s ease;
        }
        
        .progress-text {
          font-size: 14px;
          color: #5C6B73;
          text-align: center;
          font-family: 'Inter', sans-serif;
        }
        
        @media (max-width: 480px) {
          .navigation {
            flex-direction: column;
            align-items: stretch;
          }
          
          .page-nav {
            justify-content: center;
            margin-bottom: 12px;
          }
          
          .action-buttons {
            justify-content: center;
          }
          
          .action-btn {
            flex: none;
            min-width: 80px;
          }
        }
      </style>
    </head>
    <body>
      <div class="app-container">
        <div class="header">
          <h1 class="header-title">Convert PDF to Recipe</h1>
          <p class="header-subtitle" id="headerSubtitle">Choose a single page or extract all pages automatically</p>
        </div>
        
        <div class="content">
          <div class="controls">
            <div class="navigation">
              <div class="page-nav">
                <button onclick="previousPage()" id="prevBtn" class="nav-button" disabled>← Prev</button>
                <span class="page-info">Page <span id="pageNum">1</span> of <span id="pageCount">-</span></span>
                <button onclick="nextPage()" id="nextBtn" class="nav-button" disabled>Next →</button>
              </div>
              <div class="action-buttons">
                <button onclick="convertToImage()" class="action-btn btn-primary">Use This Page</button>
                <button onclick="convertAllPages()" class="action-btn btn-secondary">Use All Pages</button>
                <button onclick="cancel()" class="action-btn btn-danger">Cancel</button>
              </div>
            </div>
          </div>
          
          <div class="pdf-container">
            <div id="loadingDiv" class="loading">
              <div class="loading-spinner"></div>
              <div>Loading PDF...</div>
            </div>
            <canvas id="pdfCanvas" style="display: none;"></canvas>
          </div>
          
          <div id="progressContainer" class="progress-container" style="display: none;">
            <div class="progress-text" id="progressText">Extracting pages...</div>
            <div class="progress-bar">
              <div class="progress-fill" id="progressFill" style="width: 0%"></div>
            </div>
            <div class="progress-text" id="progressDetail">0 of 0 pages</div>
          </div>
        </div>
      </div>

      <script>
        let pdfDoc = null;
        let pageNum = 1;
        let pageIsRendering = false;
        let pageNumIsPending = null;
        
        const canvas = document.getElementById('pdfCanvas');
        const ctx = canvas.getContext('2d');
        const loadingDiv = document.getElementById('loadingDiv');
        const progressContainer = document.getElementById('progressContainer');
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        const progressDetail = document.getElementById('progressDetail');
        const headerSubtitle = document.getElementById('headerSubtitle');

        console.log('Starting PDF.js initialization...');

        // Load PDF from base64 data
        pdfjsLib.getDocument('${pdfDataUrl}').promise.then(pdfDoc_ => {
          console.log('PDF loaded successfully:', pdfDoc_);
          pdfDoc = pdfDoc_;
          document.getElementById('pageCount').textContent = pdfDoc.numPages;
          
          // Update header subtitle based on page count
          if (pdfDoc.numPages === 1) {
            headerSubtitle.textContent = 'Extract recipe from this page';
          } else {
            headerSubtitle.textContent = 'Choose a single page or extract all pages automatically';
          }
          
          // Send total pages to React Native
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'pagesLoaded',
            totalPages: pdfDoc.numPages
          }));
          
          renderPage(pageNum);
          updateNavButtons();
          loadingDiv.style.display = 'none';
          canvas.style.display = 'block';
        }).catch(err => {
          console.error('Error loading PDF:', err);
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'error',
            message: 'Failed to load PDF: ' + err.message
          }));
        });

        function renderPage(num) {
          pageIsRendering = true;
          console.log('Rendering page:', num);
          
          pdfDoc.getPage(num).then(page => {
            const viewport = page.getViewport({ scale: 2.0 });
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            const renderContext = {
              canvasContext: ctx,
              viewport: viewport
            };

            const renderTask = page.render(renderContext);
            
            renderTask.promise.then(() => {
              console.log('Page rendered successfully:', num);
              pageIsRendering = false;
              if (pageNumIsPending !== null) {
                renderPage(pageNumIsPending);
                pageNumIsPending = null;
              }
            });
          }).catch(err => {
            console.error('Error rendering page:', err);
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'error',
              message: 'Failed to render page: ' + err.message
            }));
          });

          document.getElementById('pageNum').textContent = num;
        }

        function queueRenderPage(num) {
          if (pageIsRendering) {
            pageNumIsPending = num;
          } else {
            renderPage(num);
          }
        }

        function previousPage() {
          if (pageNum <= 1) return;
          pageNum--;
          queueRenderPage(pageNum);
          updateNavButtons();
        }

        function nextPage() {
          if (pageNum >= pdfDoc.numPages) return;
          pageNum++;
          queueRenderPage(pageNum);
          updateNavButtons();
        }

        function updateNavButtons() {
          document.getElementById('prevBtn').disabled = pageNum <= 1;
          document.getElementById('nextBtn').disabled = pageNum >= pdfDoc.numPages;
        }

        function convertToImage() {
          try {
            console.log('Converting page to image...');
            const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);
            console.log('Image generated, size:', imageDataUrl.length);
            
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'imageGenerated',
              imageData: imageDataUrl,
              pageNumber: pageNum
            }));
          } catch (err) {
            console.error('Error converting to image:', err);
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'error',
              message: 'Failed to convert page to image: ' + err.message
            }));
          }
        }

        async function convertAllPages() {
          try {
            console.log('Converting all pages to images...');
            const allImages = [];
            
            // Show progress container
            progressContainer.style.display = 'block';
            progressText.textContent = 'Extracting all pages...';
            
            // Send start message
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'allPagesStarted',
              totalPages: pdfDoc.numPages
            }));
            
            // Convert each page
            for (let i = 1; i <= pdfDoc.numPages; i++) {
              console.log('Converting page', i, 'of', pdfDoc.numPages);
              
              // Update progress
              const progress = (i / pdfDoc.numPages) * 100;
              progressFill.style.width = progress + '%';
              progressDetail.textContent = i + ' of ' + pdfDoc.numPages + ' pages';
              
              // Render the page
              const page = await pdfDoc.getPage(i);
              const viewport = page.getViewport({ scale: 2.0 });
              canvas.height = viewport.height;
              canvas.width = viewport.width;

              const renderContext = {
                canvasContext: ctx,
                viewport: viewport
              };

              await page.render(renderContext).promise;
              
              // Convert to image
              const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);
              allImages.push({
                pageNumber: i,
                imageData: imageDataUrl
              });
              
              // Send progress update
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'allPagesProgress',
                currentPage: i,
                totalPages: pdfDoc.numPages,
                progress: progress
              }));
            }
            
            console.log('All pages converted:', allImages.length);
            
            // Hide progress container
            progressContainer.style.display = 'none';
            
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'allPagesGenerated',
              images: allImages
            }));
            
          } catch (err) {
            console.error('Error converting all pages:', err);
            progressContainer.style.display = 'none';
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'error',
              message: 'Failed to convert all pages: ' + err.message
            }));
          }
        }

        function cancel() {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'cancel'
          }));
        }
      </script>
    </body>
    </html>
  `;

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('WebView message:', data);
      
      switch (data.type) {
        case 'pagesLoaded':
          setTotalPages(data.totalPages);
          
          // Auto-process if enabled
          if (autoProcess) {
            console.log(`Auto-processing PDF with ${data.totalPages} pages`);
            if (data.totalPages <= 3) {
              // Process all pages for PDFs with 3 or fewer pages
              console.log('Auto-processing all pages');
              webViewRef.current?.postMessage(JSON.stringify({
                action: 'convertAllPages'
              }));
            } else {
              // Show error for PDFs with more than 3 pages
              console.log('PDF too large, showing error');
              onError(`This PDF has ${data.totalPages} pages. Please submit a PDF with 3 pages or less, or take screenshots of the recipe pages and upload those instead.`);
            }
          }
          break;
          
        case 'imageGenerated':
          setIsConverting(false);
          onImageGenerated(data.imageData);
          break;
          
        case 'allPagesStarted':
          setIsExtractingAllPages(true);
          setExtractionProgress(0);
          break;
          
        case 'allPagesProgress':
          setExtractionProgress(data.progress || 0);
          console.log(`Progress: ${data.currentPage}/${data.totalPages} (${data.progress}%)`);
          break;
          
        case 'allPagesGenerated':
          setIsExtractingAllPages(false);
          setExtractionProgress(0);
          const imageUris = data.images.map((img: any) => img.imageData);
          if (onMultiPageGenerated) {
            onMultiPageGenerated(imageUris);
          } else {
            // Fallback: use first page if no multi-page handler
            onImageGenerated(imageUris[0]);
          }
          break;
          
        case 'error':
          setIsConverting(false);
          setIsExtractingAllPages(false);
          setExtractionProgress(0);
          onError(data.message);
          break;
          
        case 'cancel':
          onCancel();
          break;
      }
    } catch (err) {
      console.error('Error parsing WebView message:', err);
      onError('Failed to process PDF conversion');
    }
  };

  if (isLoadingPDF) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading PDF...</Text>
        </View>
      </View>
    );
  }

  if (!pdfData) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load PDF</Text>
          <TouchableOpacity style={styles.retryButton} onPress={onCancel}>
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html: generatePDFToImageHTML(pdfData) }}
        style={styles.webView}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowFileAccess={true}
        allowUniversalAccessFromFileURLs={true}
        mixedContentMode="compatibility"
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('WebView error:', nativeEvent);
          onError(`WebView error: ${nativeEvent.description}`);
        }}
        onHttpError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('HTTP error:', nativeEvent);
          onError(`HTTP error: ${nativeEvent.statusCode}`);
        }}
        onLoadEnd={() => {
          console.log('WebView finished loading');
        }}
      />
      
      {(isConverting || isExtractingAllPages) && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>
              {isExtractingAllPages 
                ? `Extracting pages... ${Math.round(extractionProgress)}%` 
                : 'Converting page to image...'
              }
            </Text>
            {isExtractingAllPages && extractionProgress > 0 && (
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${extractionProgress}%` }
                  ]} 
                />
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  webView: {
    flex: 1,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: OVERLAYS.medium,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    alignItems: 'center',
    ...SHADOWS.large,
    minWidth: 200,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONT.size.body,
    fontFamily: FONT.family.inter,
    color: COLORS.textDark,
    textAlign: 'center',
  },
  progressBar: {
    width: 200,
    height: 8,
    backgroundColor: COLORS.lightGray,
    borderRadius: RADIUS.xs,
    marginTop: SPACING.md,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.xs,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
    backgroundColor: COLORS.background,
  },
  errorText: {
    fontSize: FONT.size.body,
    fontFamily: FONT.family.inter,
    color: COLORS.textDark,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.sm,
  },
  retryButtonText: {
    color: COLORS.white,
    fontFamily: FONT.family.interSemiBold,
    fontSize: FONT.size.body,
  },
}); 