import React, { useState } from 'react';
import {
  Alert,
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { COLORS, SPACING, RADIUS, ICON_SIZE } from '@/constants/theme';
import { bodyText, FONT } from '@/constants/typography';


export type UploadResult = {
  success: boolean;
  recipe?: any;
  coverImageUrl?: string;
  error?: string;
  extractedText?: string;
  imageProcessingTime?: number;
  cachedMatches?: { recipe: any; similarity: number }[];
  // New properties for loading screen navigation
  navigateToLoading?: boolean;
  imageUri?: string;
  imageUris?: string[];
  inputType?: 'image' | 'images';
};

type Props = {
  onUploadComplete: (result: UploadResult) => void;
  isLoading?: boolean;
  style?: any;
  onShowUploadModal?: () => void; // New prop to trigger custom modal
};

const RecipePDFImageUploader = React.forwardRef<any, Props>(({ onUploadComplete, isLoading, style, onShowUploadModal }, ref) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPickerActive, setIsPickerActive] = useState(false);

  // Expose methods via useImperativeHandle
  React.useImperativeHandle(ref, () => ({
    handleCamera,
    handleImagePicker,
    handleDocumentPicker,
  }));

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'We need camera roll permissions to upload images.');
      return false;
    }
    return true;
  };

  const uploadImage = async (imageUri: string, isFromPDF: boolean = false): Promise<UploadResult> => {
    try {
      setIsProcessing(true);
      
      // Convert data URL to file if it's from PDF conversion
      let finalImageUri = imageUri;
      if (imageUri.startsWith('data:image/')) {
        const fileName = `recipe-${Date.now()}.jpg`;
        const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
        
        // Convert base64 data URL to file
        const base64Code = imageUri.split(',')[1];
        await FileSystem.writeAsStringAsync(fileUri, base64Code, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        finalImageUri = fileUri;
      }

      const formData = new FormData();
      
      // Create file object for upload
      const imageFile = {
        uri: finalImageUri,
        type: 'image/jpeg',
        name: 'recipe-image.jpg',
      } as any;

      if (__DEV__) {
        console.log('Uploading to:', `${process.env.EXPO_PUBLIC_API_URL}/api/recipes/parse-image`);
        console.log('Image file info:', {
          uri: finalImageUri,
          type: imageFile.type,
          name: imageFile.name,
          isFromPDF
        });
      }

      formData.append('image', imageFile);

      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/recipes/parse-image`, {
        method: 'POST',
        body: formData,
        // Don't set Content-Type header - let the browser set it with proper boundary
      });

      if (__DEV__) {
        console.log('Response status:', response.status);
      }

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Upload failed - Response:', errorData);
        throw new Error(`Upload failed: ${response.status} - ${errorData}`);
      }

      const result = await response.json();
      
      return {
        success: true,
        recipe: result.recipe,
        coverImageUrl: result.coverImageUrl,
        extractedText: result.extractedText,
        imageProcessingTime: result.imageProcessingTime,
        cachedMatches: result.cachedMatches,
      };
    } catch (error: any) {
      console.error('Multi-image upload error:', error);
      throw new Error(error.message || 'Failed to upload images');
    } finally {
      setIsProcessing(false);
    }
  };



  const uploadMultipleImages = async (imageUris: string[]): Promise<UploadResult> => {
    try {
      setIsProcessing(true);
      
      const formData = new FormData();
      
      // Convert all images and add to form data
      for (let i = 0; i < imageUris.length; i++) {
        const imageUri = imageUris[i];
        let finalImageUri = imageUri;
        
        if (imageUri.startsWith('data:image/')) {
          const fileName = `recipe-page-${i + 1}-${Date.now()}.jpg`;
          const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
          
          // Convert base64 data URL to file
          const base64Code = imageUri.split(',')[1];
          await FileSystem.writeAsStringAsync(fileUri, base64Code, {
            encoding: FileSystem.EncodingType.Base64,
          });
          
          finalImageUri = fileUri;
        }

        // Create file object for upload
        const imageFile = {
          uri: finalImageUri,
          type: 'image/jpeg',
          name: `recipe-page-${i + 1}.jpg`,
        } as any;

        formData.append('images', imageFile);
      }

      if (__DEV__) {
        console.log('Uploading', imageUris.length, 'images to:', `${process.env.EXPO_PUBLIC_API_URL}/api/recipes/parse-images`);
      }

      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/recipes/parse-images`, {
        method: 'POST',
        body: formData,
        // Don't set Content-Type header - let the browser set it with proper boundary
      });

      if (__DEV__) {
        console.log('Multi-image response status:', response.status);
      }

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Multi-image upload failed - Response:', errorData);
        throw new Error(`Upload failed: ${response.status} - ${errorData}`);
      }

      const result = await response.json();
      
      return {
        success: true,
        recipe: result.recipe,
        coverImageUrl: result.coverImageUrl,
        extractedText: result.extractedText,
        imageProcessingTime: result.imageProcessingTime,
        cachedMatches: result.cachedMatches,
      };

    } catch (error) {
      console.error('Upload error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImagePicker = async () => {
    if (isPickerActive) {
      if (__DEV__) {
      console.log('Image picker already active, ignoring request');
    }
      return;
    }

    try {
      setIsPickerActive(true);
      if (!await requestPermissions()) return;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        // Navigate to loading screen for image processing
        onUploadComplete({
          success: true,
          navigateToLoading: true,
          imageUri: result.assets[0].uri,
          inputType: 'image'
        } as any);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    } finally {
      setIsPickerActive(false);
    }
  };

  const handleCamera = async () => {
    if (isPickerActive) {
      console.log('Camera picker already active, ignoring request');
      return;
    }

    try {
      setIsPickerActive(true);
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'We need camera permissions to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        // Navigate to loading screen for image processing
        onUploadComplete({
          success: true,
          navigateToLoading: true,
          imageUri: result.assets[0].uri,
          inputType: 'image'
        } as any);
      }
    } catch (error) {
      console.error('Camera picker error:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    } finally {
      setIsPickerActive(false);
    }
  };



  const handleDocumentPicker = async () => {
    if (isPickerActive) {
      console.log('Document picker already active, ignoring request');
      return;
    }

    try {
      setIsPickerActive(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const file = result.assets[0];
        
        if (file.mimeType === 'application/pdf') {
          // Navigate directly to loading screen for PDF processing
          console.log('Processing PDF:', file.name);
          
          onUploadComplete({
            success: true,
            navigateToLoading: true,
            imageUri: file.uri,
            inputType: 'image' // PDFs will be treated as images in the loading screen
          } as any);
        } else if (file.mimeType?.startsWith('image/')) {
          // Navigate to loading screen for image processing
          onUploadComplete({
            success: true,
            navigateToLoading: true,
            imageUri: file.uri,
            inputType: 'image'
          } as any);
        }
      }
    } catch (error) {
      console.error('Document picker error:', error);
      Alert.alert('Error', 'Failed to pick document. Please try again.');
    } finally {
      setIsPickerActive(false);
    }
  };



  const showUploadOptions = () => {
    if (onShowUploadModal) {
      // Use custom modal if provided
      onShowUploadModal();
    } else {
      // Fallback to native alert
      Alert.alert(
        'Upload Recipe',
        'Choose how you\'d like to add your recipe',
        [
          { text: 'Take Photo', onPress: handleCamera },
          { text: 'Choose Image', onPress: handleImagePicker },
          { text: 'Browse Files (PDF/Images)', onPress: handleDocumentPicker },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  const isButtonDisabled = isLoading || isProcessing || isPickerActive;

  return (
    <>
      <TouchableOpacity
        style={[styles.uploadButton, style, isButtonDisabled && styles.disabled]}
        onPress={showUploadOptions}
        disabled={isButtonDisabled}
      >
        {isProcessing ? (
          <ActivityIndicator size="small" color={COLORS.primary} />
        ) : (
          <MaterialCommunityIcons
            name="plus"
            size={ICON_SIZE.md}
            color={COLORS.primary}
          />
        )}
      </TouchableOpacity>


    </>
  );
});

export default RecipePDFImageUploader;

const styles = StyleSheet.create({
  uploadButton: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: SPACING.sm,
    paddingRight: SPACING.sm,
  },
  disabled: {
    opacity: 0.5,
  },
}); 