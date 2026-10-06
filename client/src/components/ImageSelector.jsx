import React, { useRef } from 'react';
import { PRESET_PUZZLES } from '../utils/presets';

export function ImageSelector({
  isOpen,
  onClose,
  currentPresetId,
  onSelectPreset,
  onUploadCustomImage,
  customImageUrl
}) {
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          onUploadCustomImage(event.target.result);
          onClose();
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box solid-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-top">
          <h2 className="action-title modal-heading">CHOOSE ARTWORK</h2>
          <button type="button" className="btn-icon-simple modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <p className="modal-description">
          Select an Avengers image or upload a picture from your device.
        </p>

        {/* Gallery Grid */}
        <div className="gallery-grid">
          {PRESET_PUZZLES.map((preset) => {
            const isSelected = currentPresetId === preset.id;
            return (
              <div
                key={preset.id}
                className={`gallery-card ${isSelected ? 'card-selected' : ''}`}
                onClick={() => {
                  onSelectPreset(preset);
                  onClose();
                }}
              >
                <div className="card-thumb">
                  <img src={preset.src} alt={preset.title} className="thumb-img" />
                  {isSelected && <div className="card-active-indicator">SELECTED</div>}
                </div>
                <div className="card-info">
                  <span className="card-title">{preset.title}</span>
                  <span className="card-sub">{preset.hero}</span>
                </div>
              </div>
            );
          })}

          {/* Custom Upload Card */}
          <div
            className={`gallery-card upload-gallery-card ${currentPresetId === 'custom' ? 'card-selected' : ''}`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <div className="card-thumb upload-thumb">
              {customImageUrl && currentPresetId === 'custom' ? (
                <img src={customImageUrl} alt="Custom uploaded art" className="thumb-img" />
              ) : (
                <div className="upload-cta">
                  <span className="action-title upload-cta-title">+ UPLOAD</span>
                  <span className="upload-cta-sub">JPG or PNG</span>
                </div>
              )}
            </div>
            <div className="card-info">
              <span className="card-title">Custom Image</span>
              <span className="card-sub">Your Computer</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
