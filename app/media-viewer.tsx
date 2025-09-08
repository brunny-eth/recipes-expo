import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Image, ActivityIndicator, Pressable, StyleSheet, ScrollView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import WebView from 'react-native-webview';

function inferType(uri: string, mime?: string): 'pdf' | 'image' {
  if (mime?.startsWith('application/pdf')) return 'pdf';
  if (uri.toLowerCase().endsWith('.pdf')) return 'pdf';
  return 'image';
}

export default function MediaViewer() {
  const params = useLocalSearchParams<{ uri: string; mime?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [currentScale, setCurrentScale] = useState(1);
  const [imageKey, setImageKey] = useState(0);
  const [loadStartTime, setLoadStartTime] = useState<number | null>(null);

  const { uri, mime } = params;
  const type = inferType(uri, mime);

  // Log on mount
  useEffect(() => {
    console.log("[media] open", { type, uri });
  }, [type, uri]);

  // Timeout to prevent stuck loading state
  useEffect(() => {
    if (!loading) return;

    const timeout = setTimeout(() => {
      console.log("[media] loading timeout - clearing loading state");
      setLoading(false);
      setLoadStartTime(null);
      // Clear any pending image timer
      if ((global as any).imageLoadTimer) {
        clearTimeout((global as any).imageLoadTimer);
      }
    }, 10000); // 10 second timeout

    return () => clearTimeout(timeout);
  }, [loading]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if ((global as any).imageLoadTimer) {
        clearTimeout((global as any).imageLoadTimer);
      }
    };
  }, []);

  const handleClose = () => {
    router.back();
  };

  const handleRetry = () => {
    if (type === 'image') {
      setImageKey(prev => prev + 1);
      // Don't set loading here - let the smart loading logic handle it
      setError(false);
    } else {
      setLoading(true);
      setError(false);
    }
  };

  const handleImagePress = () => {
    if (Platform.OS === 'ios' && scrollRef.current) {
      const nextScale = currentScale === 1 ? 2 : 1;
      setCurrentScale(nextScale);
      scrollRef.current.setNativeProps({ zoomScale: nextScale });
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Pressable
        onPress={handleClose}
        style={[styles.closeButton, { top: insets.top + 8, left: 12 }]}
        hitSlop={{ top: 12, left: 12, bottom: 12, right: 12 }}
      >
        <Text style={styles.closeText}>Close</Text>
      </Pressable>

      {type === 'pdf' ? (
        <View style={styles.content}>
          <WebView
            source={{ uri }}
            style={styles.webview}
            setSupportMultipleWindows={false}
            bounces={false}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            allowsBackForwardNavigationGestures={Platform.OS === 'ios'}
            onLoadStart={() => {
              console.log("[media] pdf load start");
              setLoadStartTime(Date.now());
              setLoading(true);
              setError(false);
            }}
            onLoadEnd={() => {
              console.log("[media] pdf load end");
              setLoading(false);
              setLoadStartTime(null);
            }}
            onError={(syntheticEvent) => {
              console.log("[media] pdf error", { type, uri, error: syntheticEvent.nativeEvent });
              setLoading(false);
              setLoadStartTime(null);
              setError(true);
            }}
            onHttpError={(syntheticEvent) => {
              console.log("[media] pdf http error", { type, uri, statusCode: syntheticEvent.nativeEvent.statusCode });
              setLoading(false);
              setLoadStartTime(null);
              setError(true);
            }}
          />
          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.loadingText}>Loading PDF...</Text>
            </View>
          )}
          {error && (
            <View style={styles.errorOverlay}>
              <Text style={styles.errorText}>Failed to load PDF</Text>
              <Pressable onPress={handleRetry} style={styles.retryButton}>
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
              <Pressable onPress={handleClose} style={styles.closeErrorButton}>
                <Text style={styles.closeErrorText}>Close</Text>
              </Pressable>
            </View>
          )}
        </View>
      ) : (
        <>
          <ScrollView
            ref={scrollRef}
            style={styles.content}
            maximumZoomScale={Platform.OS === 'ios' ? 3 : 1}
            minimumZoomScale={1}
            bouncesZoom
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.zoomContainer}
            scrollEnabled={false}
          >
            <Pressable onPress={handleImagePress} style={styles.imageContainer}>
              <Image
                key={imageKey}
                source={{ uri }}
                style={styles.image}
                resizeMode="contain"
                onLoadStart={() => {
                  console.log("[media] image load start");
                  setLoadStartTime(Date.now());
                  // Only show loading if it takes more than 200ms (avoid flash for fast loads)
                  const timer = setTimeout(() => {
                    if (loadStartTime) { // Still loading
                      setLoading(true);
                    }
                  }, 200);
                  // Store timer for cleanup if needed
                  (global as any).imageLoadTimer = timer;
                }}
                onLoadEnd={() => {
                  console.log("[media] image load end");
                  if ((global as any).imageLoadTimer) {
                    clearTimeout((global as any).imageLoadTimer);
                  }
                  setLoading(false);
                  setLoadStartTime(null);
                }}
                onError={(error) => {
                  console.log("[media] image error", { type, uri, error });
                  setLoading(false);
                  setLoadStartTime(null);
                  // Clear any pending timer
                  if ((global as any).imageLoadTimer) {
                    clearTimeout((global as any).imageLoadTimer);
                  }
                  setError(true);
                }}
              />
            </Pressable>
          </ScrollView>
          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.loadingText}>Loading image...</Text>
            </View>
          )}
          {error && (
            <View style={styles.errorOverlay}>
              <Text style={styles.errorText}>Failed to load image</Text>
              <Pressable onPress={handleRetry} style={styles.retryButton}>
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
              <Pressable onPress={handleClose} style={styles.closeErrorButton}>
                <Text style={styles.closeErrorText}>Close</Text>
              </Pressable>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  closeButton: {
    position: 'absolute',
    zIndex: 1,
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
  },
  closeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  zoomContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 12,
    marginBottom: 20,
    textAlign: 'center',
  },
  errorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  errorText: {
    color: '#fff',
    fontSize: 18,
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  closeErrorButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  closeErrorText: {
    color: '#fff',
    fontSize: 16,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
