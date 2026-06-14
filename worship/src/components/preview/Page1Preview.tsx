import { useWorshipStore } from '../../stores/worshipStore';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

export default function Page1Preview() {
  const { date, title, sermonTitle, coverImage } = useWorshipStore();

  const formattedDate = date
    ? format(new Date(date), 'yyyy년 M월 d일 (EEEE)', { locale: ko })
    : '';

  // 설교제목에서 성경 구절 분리
  const parseSermonTitle = (sermonTitle: string) => {
    const match = sermonTitle.match(/\(([^)]+)\)/);
    if (match) {
      return {
        title: sermonTitle.replace(/\s*\([^)]+\)\s*$/, '').trim(),
        bibleRef: match[1]
      };
    }
    return { title: sermonTitle, bibleRef: '' };
  };

  const { title: sermonTitleText, bibleRef } = parseSermonTitle(sermonTitle);

  return (
    <div 
      className="h-full bg-white"
      style={{ 
        fontFamily: '나눔고딕, Nanum Gothic, sans-serif',
        padding: '40px 50px',
        color: '#000000'
      }}
    >
      <table 
        style={{ 
          width: '100%',
          height: '100%',
          borderCollapse: 'collapse',
          tableLayout: 'fixed'
        }}
      >
        <tbody>
        {/* 상단: 날짜 (우측 정렬) */}
        <tr>
          <td colSpan={2} style={{ textAlign: 'right', paddingBottom: '60px', verticalAlign: 'top' }}>
            <span style={{ fontSize: '15px', color: '#000000' }}>
              {formattedDate || '(날짜를 입력하세요)'}
            </span>
          </td>
        </tr>

        {/* 제목 행 */}
        <tr>
          <td colSpan={2} style={{ textAlign: 'center', paddingBottom: '0px', verticalAlign: 'middle' }}>
            <div style={{ fontSize: '36px', fontWeight: '700', color: '#000000', letterSpacing: '1px' }}>
              {title || '(제목을 입력하세요)'}
            </div>
          </td>
        </tr>

        {/* 가정예배 제목 (표지 타이틀) */}
        <tr>
          <td colSpan={2} style={{ textAlign: 'center', paddingBottom: '10px', paddingTop: '0px', verticalAlign: 'middle' }}>
            <div style={{ fontSize: '80px', fontWeight: '800', color: '#000000', letterSpacing: '24px' }}>
              가정예배
            </div>
          </td>
        </tr>

        {/* 설교제목 및 성경 구절 */}
        <tr>
          <td colSpan={2} style={{ textAlign: 'center', paddingBottom: '20px', verticalAlign: 'middle' }}>
            <div style={{ fontSize: '25px', fontWeight: '600', color: '#000000', marginBottom: '5px' }}>
              {sermonTitleText || '(설교제목을 입력하세요)'}
            </div>
            {bibleRef && (
              <div style={{ fontSize: '20px', color: '#000000', fontStyle: 'normal' }}>
                ({bibleRef})
              </div>
            )}
          </td>
        </tr>

        {/* 구분선 */}
        <tr>
          <td colSpan={2} style={{ paddingBottom: '30px' }}>
            <div style={{ borderTop: '2px solid #BDC3C7', width: '100%' }}></div>
          </td>
        </tr>

        {/* 표지 이미지 (중앙 정렬, 150mm x 150mm) */}
        <tr>
          <td colSpan={2} style={{ textAlign: 'center', verticalAlign: 'middle', height: '100%' }}>
            {coverImage ? (
              <img
                src={coverImage}
                alt="표지"
                style={{ 
                  width: '150mm',
                  height: '150mm',
                  objectFit: 'cover',
                  borderRadius: '4px',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
                  display: 'block',
                  margin: '0 auto'
                }}
              />
            ) : (
              <div 
                style={{ 
                  width: '150mm',
                  height: '150mm',
                  margin: '0 auto',
                  border: '2px dashed #BDC3C7',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#000000',
                  fontSize: '14px',
                  backgroundColor: '#FAFAFA'
                }}
              >
                표지 이미지를 업로드하세요
              </div>
            )}
          </td>
        </tr>
        </tbody>
      </table>
    </div>
  );
}

