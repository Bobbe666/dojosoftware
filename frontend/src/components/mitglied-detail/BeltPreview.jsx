import React from 'react';

const BeltPreview = ({ primaer, sekundaer, size = 'normal', className = '' }) => {
  const sizeClass = {
    small: 'belt-preview-small',
    normal: 'belt-preview',
    large: 'belt-preview-large',
  }[size] || 'belt-preview';

  return (
    <div className={`${sizeClass} ${className}`}>
      <div className="belt-base" style={{ '--belt-primaer': primaer || '#CCCCCC' }}>
        {sekundaer && (
          <div className="belt-stripe" style={{ '--belt-sekundaer': sekundaer }} />
        )}
      </div>
    </div>
  );
};

export default BeltPreview;
