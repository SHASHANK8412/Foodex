import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Cloud, X, AlertCircle } from 'lucide-react';

const ImageUploadSection = ({ 
  onImageSelect, 
  currentImage, 
  isLoading = false,
  preview 
}) => {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');

  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    setError('');

    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0];
      if (rejection.errors[0].code === 'file-too-large') {
        setError('File size must not exceed 5MB');
      } else if (rejection.errors[0].code === 'file-invalid-type') {
        setError('Only JPEG and PNG images are allowed');
      } else {
        setError('Invalid file');
      }
      return;
    }

    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      
      // Show preview
      const reader = new FileReader();
      reader.onload = () => {
        onImageSelect(file, reader.result);
      };
      reader.readAsDataURL(file);
    }
  }, [onImageSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png'],
    },
    maxSize: 5 * 1024 * 1024, // 5MB
    maxFiles: 1,
  });

  const handleRemoveImage = () => {
    onImageSelect(null, null);
    setError('');
    setUploadProgress(0);
  };

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-gray-700">
        Menu Item Image
      </label>

      {/* Preview */}
      {preview && (
        <div className="relative w-full h-48 rounded-lg overflow-hidden bg-gray-100">
          <img 
            src={preview} 
            alt="Preview" 
            className="w-full h-full object-cover"
          />
          <button
            type="button"
            onClick={handleRemoveImage}
            disabled={isLoading}
            className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white rounded-full p-2 transition"
          >
            <X size={16} />
          </button>
          
          {/* Upload Progress */}
          {isLoading && (
            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50">
              <div className="h-1 bg-gray-300">
                <div 
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-white text-xs text-center py-1">
                Uploading... {Math.round(uploadProgress)}%
              </p>
            </div>
          )}
        </div>
      )}

      {/* Upload Zone */}
      {!preview && (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-300 bg-gray-50 hover:border-gray-400'
          }`}
        >
          <input {...getInputProps()} disabled={isLoading} />
          
          <Cloud 
            size={48} 
            className={`mx-auto mb-3 ${isDragActive ? 'text-blue-500' : 'text-gray-400'}`}
          />
          <p className="text-gray-600 font-medium">
            {isDragActive 
              ? 'Drop the image here...' 
              : 'Drag and drop an image here, or click to select'}
          </p>
          <p className="text-gray-500 text-sm mt-1">
            Supported formats: JPEG, PNG (Max 5MB)
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle size={18} className="text-red-600 flex-shrink-0" />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Current Image Info */}
      {currentImage && !preview && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-blue-700 text-sm">
            Current image: <span className="font-medium">{currentImage.split('/').pop()}</span>
          </p>
          <p className="text-blue-600 text-xs mt-1">Upload a new image to replace it</p>
        </div>
      )}
    </div>
  );
};

export default ImageUploadSection;
