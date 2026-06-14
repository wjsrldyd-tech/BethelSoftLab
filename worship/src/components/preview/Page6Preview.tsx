import { useWorshipStore } from '../../stores/worshipStore';

// 6페이지: 나눔 및 마침기도
export default function Page6Preview() {
  const { sharing1, sharing2, closingPrayer } = useWorshipStore();

  return (
    <div 
      className="h-full flex flex-col bg-white overflow-y-auto"
      style={{ 
        fontFamily: '나눔고딕, Nanum Gothic, sans-serif',
        padding: '40px 45px',
        color: '#000000'
      }}
    >
      {/* 제목 - 홀수 페이지, 우측 정렬 */}
      <div style={{ textAlign: 'right', paddingBottom: '30px', verticalAlign: 'top' }}>
        <span style={{ fontSize: '20px', color: '#000000' }}>
          나눔과 기도
        </span>
      </div>

      {/* 나눔 영역 (2분할) */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: '1', minHeight: 0 }}>
        {/* 나눔1 */}
        <div style={{ flex: '1', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <h2 
            style={{ 
              fontSize: '28px',
              fontWeight: '700',
              color: '#000000',
              marginBottom: '20px',
              letterSpacing: '0.5px'
            }}
          >
            나눔1
          </h2>
          <div 
            style={{ 
              fontSize: '16px',
              lineHeight: '2',
              color: '#000000',
              whiteSpace: 'pre-wrap',
              flex: '1',
              overflow: 'hidden'
            }}
          >
            {sharing1 || '(나눔1 내용을 입력하세요)'}
          </div>
        </div>

        {/* 나눔1과 나눔2 구분선 */}
        <div 
          style={{ 
            borderTop: '2px solid #BDC3C7',
            margin: '0',
            flex: '0 0 auto'
          }}
        ></div>

        {/* 나눔2 */}
        <div style={{ flex: '1', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <h2 
            style={{ 
              fontSize: '28px',
              fontWeight: '700',
              color: '#000000',
              marginBottom: '20px',
              letterSpacing: '0.5px',
              marginTop: '20px'
            }}
          >
            나눔2
          </h2>
          <div 
            style={{ 
              fontSize: '16px',
              lineHeight: '2',
              color: '#000000',
              whiteSpace: 'pre-wrap',
              flex: '1',
              overflow: 'hidden'
            }}
          >
            {sharing2 || '(나눔2 내용을 입력하세요)'}
          </div>
        </div>
      </div>

      {/* 마침기도 위 가로바 */}
      <div 
        style={{ 
          borderTop: '2px solid #BDC3C7',
          margin: '0',
          flex: '0 0 auto'
        }}
      ></div>

      {/* 마침기도 */}
      <div style={{ flex: '0 0 auto', marginTop: '20px' }}>
        <h2 
          style={{ 
            fontSize: '28px',
            fontWeight: '700',
            color: '#000000',
            marginBottom: '20px',
            letterSpacing: '0.5px'
          }}
        >
          마침기도
        </h2>
        <div 
          style={{ 
            fontSize: '16px',
            lineHeight: '2',
            color: '#000000',
            whiteSpace: 'pre-wrap'
          }}
        >
          {closingPrayer || '(마침기도 내용을 입력하세요)'}
        </div>
      </div>
    </div>
  );
}
