import { useWorshipStore } from '../../stores/worshipStore';

// 5페이지: 예배기도 및 말씀
export default function Page5Preview() {
  const { prayerContent, sermonContentTitle, sermonContent, sermonImage, sermonLineHeight } = useWorshipStore();

  return (
    <div 
      className="h-full flex flex-col bg-white overflow-y-auto"
      style={{ 
        fontFamily: '나눔고딕, Nanum Gothic, sans-serif',
        padding: '40px 45px',
        color: '#000000'
      }}
    >
      {/* 제목 - 짝수 페이지, 좌측 정렬 */}
      <div style={{ textAlign: 'left', paddingBottom: '30px', verticalAlign: 'top' }}>
        <span style={{ fontSize: '20px', color: '#000000' }}>
          예배와 말씀
        </span>
      </div>

      {/* 예배기도 */}
      <div>
        <h2 
          style={{ 
            fontSize: '28px',
            fontWeight: '700',
            color: '#000000',
            marginBottom: '20px',
            letterSpacing: '0.5px'
          }}
        >
          예배기도
        </h2>
        <div 
          style={{ 
            fontSize: '16px',
            lineHeight: '2',
            color: '#000000',
            whiteSpace: 'pre-wrap',
            marginBottom: '0'
          }}
        >
          {prayerContent || '(기도 내용을 입력하세요)'}
        </div>
        <div 
          style={{ 
            borderTop: '2px solid #BDC3C7',
            marginTop: '0',
            marginBottom: '40px'
          }}
        ></div>
      </div>

      {/* 말씀 */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: '1', minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '20px' }}>
          <h2 
            style={{ 
              fontSize: '28px',
              fontWeight: '700',
              color: '#000000',
              letterSpacing: '0.5px',
              margin: 0
            }}
          >
            말씀
          </h2>
          {sermonContentTitle && (
            <p 
              style={{ 
                fontSize: '18px',
                fontWeight: '600',
                color: '#000000',
                lineHeight: '1.6',
                margin: 0
              }}
            >
              {sermonContentTitle}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', flex: '1', minHeight: 0, justifyContent: 'flex-start', alignItems: 'flex-start', overflow: 'hidden' }}>
          <div 
            style={{ 
              fontSize: '16px',
              lineHeight: sermonLineHeight || '4',
              color: '#000000',
              whiteSpace: 'pre-wrap',
              flex: sermonImage ? '1 1 0' : '0 0 auto',
              width: '100%',
              overflow: 'hidden',
              minHeight: 0
            }}
          >
            {sermonContent || '(말씀 내용을 입력하세요)'}
          </div>
          {sermonImage && (
            <div style={{ flex: '0 0 auto', paddingTop: '20px', width: '100%' }}>
              <img
                src={sermonImage}
                alt="말씀 이미지"
                style={{ 
                  maxWidth: '100%',
                  objectFit: 'contain',
                  aspectRatio: '16/9',
                  borderRadius: '8px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

