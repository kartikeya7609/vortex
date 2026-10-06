import React from 'react';

export function PreviewModal({ isOpen, onClose, imageSrc, title, hero }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box solid-panel preview-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-top">
          <h2 className="action-title modal-heading">IMAGE PREVIEW</h2>
          <button type="button" className="btn-icon-simple modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="preview-frame">
          <img src={imageSrc} alt={title || "Avengers Artwork"} className="preview-img" />
          <div className="preview-caption">
            <span className="action-title preview-title">{title || "Marvel Artwork"}</span>
            <span className="preview-sub">{hero}</span>
          </div>
        </div>

        <div className="modal-bottom-actions">
          <button type="button" className="btn-game btn-red" onClick={onClose}>
            BACK TO GAME
          </button>
        </div>
      </div>
    </div>
  );
}
