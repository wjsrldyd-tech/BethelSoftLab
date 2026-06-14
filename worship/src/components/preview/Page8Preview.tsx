
// 8페이지: 주기도문
export default function Page8Preview() {
  return (
    <div 
      className="h-full flex flex-col bg-white"
      style={{ 
        fontFamily: '나눔고딕, Nanum Gothic, sans-serif',
        padding: '40px 50px',
        color: '#000000'
      }}
    >
      {/* 제목 - 홀수 페이지, 우측 정렬 */}
      <div style={{ textAlign: 'right', paddingBottom: '30px', verticalAlign: 'top' }}>
        <span style={{ fontSize: '20px', color: '#000000' }}>
          주기도문
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
          <p style={{ marginBottom: '12px' }}>하늘에 계신 우리 아버지여</p>
          <p style={{ marginBottom: '12px' }}>이름이 거룩히 여김을 받으시오며</p>
          <p style={{ marginBottom: '12px' }}>나라가 임하시오며</p>
          <p style={{ marginBottom: '12px' }}>뜻이 하늘에서 이루어진 것 같이</p>
          <p style={{ marginBottom: '12px' }}>땅에서도 이루어지이다</p>
          <p style={{ marginBottom: '12px' }}>오늘 우리에게 일용할 양식을 주시옵고</p>
          <p style={{ marginBottom: '12px' }}>우리가 우리에게 죄 지은 자를 사하여 준 것 같이</p>
          <p style={{ marginBottom: '12px' }}>우리 죄를 사하여 주시옵고</p>
          <p style={{ marginBottom: '12px' }}>우리를 시험에 들게 하지 마시옵고</p>
          <p style={{ marginBottom: '12px' }}>다만 악에서 구하시옵소서</p>
          <p style={{ marginBottom: '20px' }}>나라와 권세와 영광이 아버지께 영원히 있사옵나이다.</p>
          <p style={{ fontSize: '20px', fontWeight: '600', marginTop: '30px' }}>아멘</p>
        </div>
      </div>
    </div>
  );
}
