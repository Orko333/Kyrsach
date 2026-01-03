import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaChevronLeft, FaChevronRight, FaDownload } from 'react-icons/fa';
import './ImageGallery.css';

const ImageGallery = ({ images, initialIndex = 0, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const handleDownload = () => {
    const image = images[currentIndex];
    const link = document.createElement('a');
    link.href = image.url;
    link.download = `story-image-${currentIndex + 1}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowLeft') handlePrevious();
    if (e.key === 'ArrowRight') handleNext();
    if (e.key === 'Escape') onClose();
  };

  React.useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!images || images.length === 0) return null;

  const currentImage = images[currentIndex];

  return (
    <motion.div
      className="image-gallery-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <div className="image-gallery-container" onClick={(e) => e.stopPropagation()}>
        <button className="gallery-close" onClick={onClose} aria-label="Close gallery">
          <FaTimes />
        </button>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            className="gallery-image-wrapper"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3 }}
          >
            <img
              src={currentImage.url}
              alt={currentImage.description || `Image ${currentIndex + 1}`}
              className="gallery-image"
            />
            {currentImage.description && (
              <p className="gallery-description">{currentImage.description}</p>
            )}
          </motion.div>
        </AnimatePresence>

        {images.length > 1 && (
          <>
            <button
              className="gallery-nav gallery-prev"
              onClick={handlePrevious}
              aria-label="Previous image"
            >
              <FaChevronLeft />
            </button>
            <button
              className="gallery-nav gallery-next"
              onClick={handleNext}
              aria-label="Next image"
            >
              <FaChevronRight />
            </button>
          </>
        )}

        <div className="gallery-controls">
          <button className="gallery-download" onClick={handleDownload} aria-label="Download image">
            <FaDownload /> Завантажити
          </button>
          <span className="gallery-counter">
            {currentIndex + 1} / {images.length}
          </span>
        </div>

        {images.length > 1 && (
          <div className="gallery-thumbnails">
            {images.map((img, index) => (
              <button
                key={index}
                className={`thumbnail ${index === currentIndex ? 'active' : ''}`}
                onClick={() => setCurrentIndex(index)}
              >
                <img src={img.url} alt={`Thumbnail ${index + 1}`} />
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ImageGallery;
