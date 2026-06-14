import { PageNumber } from '../../types';
import Page1Preview from './Page1Preview';
import Page3Preview from './Page3Preview';
import Page4Preview from './Page4Preview';
import Page5Preview from './Page5Preview';
import Page6Preview from './Page6Preview';
import Page7Preview from './Page7Preview';
import Page8Preview from './Page8Preview';

interface PagePreviewProps {
  pageNumber: PageNumber;
}

export default function PagePreview({ pageNumber }: PagePreviewProps) {
  switch (pageNumber) {
    case 1:
      return <Page1Preview />;
    case 2:
      return <Page4Preview />;
    case 3:
      return <Page3Preview />;
    case 4:
      return <Page5Preview />;
    case 5:
      return <Page6Preview />;
    case 6:
      return <Page7Preview />;
    case 7:
      return <Page8Preview />;
    default:
      return null;
  }
}

