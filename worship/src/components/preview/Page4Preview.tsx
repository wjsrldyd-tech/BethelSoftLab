
// 4페이지: 사도신경
export default function Page4Preview() {
  return (
    <div 
      className="h-full flex flex-col bg-white"
      style={{ 
        fontFamily: '나눔고딕, Nanum Gothic, sans-serif',
        padding: '40px 50px',
        color: '#000000'
      }}
    >
      {/* 제목 - 2페이지, 좌측 정렬 */}
      <div style={{ textAlign: 'left', paddingBottom: '30px', verticalAlign: 'top' }}>
        <span style={{ fontSize: '20px', color: '#000000' }}>
          사도신경
        </span>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div 
          style={{ 
            maxWidth: '600px',
            lineHeight: '2.2',
            fontSize: '17px',
            color: '#000000',
            textAlign: 'center'
          }}
        >
          <p style={{ marginBottom: '12px' }}>전능하사 천지를 만드신 하나님 아버지를</p>
          <p style={{ marginBottom: '12px' }}>내가 믿사오며,</p>
          <p style={{ marginBottom: '12px' }}>그 외아들</p>
          <p style={{ marginBottom: '12px' }}>우리 주 예수 그리스도를 믿사오니,</p>
          <p style={{ marginBottom: '12px' }}>이는 성령으로 잉태하사</p>
          <p style={{ marginBottom: '12px' }}>동정녀 마리아에게 나시고,</p>
          <p style={{ marginBottom: '12px' }}>본디오 빌라도에게 고난을 받으사,</p>
          <p style={{ marginBottom: '12px' }}>십자가에 못박혀 죽으시고,</p>
          <p style={{ marginBottom: '12px' }}>장사한지 사흘만에 죽은자 가운데서 다시 살아나시며,</p>
          <p style={{ marginBottom: '12px' }}>하늘에 오르사,</p>
          <p style={{ marginBottom: '12px' }}>전능하신 하나님 우편에 앉아 계시다가,</p>
          <p style={{ marginBottom: '12px' }}>저리로서 산 자와 죽은 자를 심판하러 오시리라.</p>
          <p style={{ marginBottom: '12px' }}>성령을 믿사오며,</p>
          <p style={{ marginBottom: '12px' }}>거룩한 공회와,</p>
          <p style={{ marginBottom: '12px' }}>성도가 서로 교통하는 것과,</p>
          <p style={{ marginBottom: '12px' }}>죄를 사하여 주시는 것과,</p>
          <p style={{ marginBottom: '12px' }}>몸이 다시 사는 것과, 영원히 사는 것을 믿사옵나이다.</p>
          <p style={{ fontSize: '20px', fontWeight: '600', marginTop: '30px' }}>아멘.</p>
        </div>
      </div>
    </div>
  );
}

