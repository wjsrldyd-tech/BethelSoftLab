import React, { useState, useRef, useEffect } from 'react';
import { useWorshipStore } from '../../stores/worshipStore';

export default function Page3Preview() {
  const { hymn1Image } = useWorshipStore();
  const [imageStyle, setImageStyle] = useState<React.CSSProperties>({});
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!hymn1Image || !imageRef.current) return;

    const handleImageLoad = () => {
      // 세로가 긴 이미지: 세로와 가로 모두 컨테이너에 맞춤
      // 가로가 긴 이미지: 가로와 세로 모두 컨테이너에 맞춤
      setImageStyle({
        width: '100%',
        height: '100%',
        objectFit: 'fill',
        borderRadius: '4px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      });
    };

    const img = imageRef.current;
    if (img.complete) {
      handleImageLoad();
    } else {
      img.addEventListener('load', handleImageLoad);
      return () => img.removeEventListener('load', handleImageLoad);
    }
  }, [hymn1Image]);

  return (
    <div 
      className="h-full flex flex-col bg-white"
      style={{ 
        fontFamily: '나눔고딕, Nanum Gothic, sans-serif',
        padding: '40px 40px',
        color: '#000000'
      }}
    >
      {/* 제목 - 3페이지, 우측 정렬 */}
      <div style={{ textAlign: 'right', paddingBottom: '30px', verticalAlign: 'top' }}>
        <span style={{ fontSize: '20px', color: '#000000' }}>
          경배와 찬양
        </span>
      </div>

      <div 
        className="flex-1 flex items-start justify-center" 
        style={{ minHeight: '400px', width: '100%', height: '100%' }}
      >
        {hymn1Image ? (
          <img
            ref={imageRef}
            src={hymn1Image}
            alt="경배와 찬양 악보"
            style={imageStyle}
          />
        ) : (
          <div 
            style={{ 
              width: '100%',
              height: '400px',
              border: '2px dashed #BDC3C7',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#000000',
              fontSize: '16px'
            }}
          >
            악보 이미지를 업로드하세요
          </div>
        )}
      </div>
    </div>
  );
}

