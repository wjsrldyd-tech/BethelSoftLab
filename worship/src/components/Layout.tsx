import { ReactNode } from 'react';

interface LayoutProps {
  leftPanel: ReactNode;
  rightPanel: ReactNode;
}

export default function Layout({ leftPanel, rightPanel }: LayoutProps) {
  return (
    <div className="w-full h-screen bg-gray-50 flex">
      {/* 입력 영역 */}
      <div className="w-1/2 border-r border-primary-border bg-white overflow-y-auto">
        {leftPanel}
      </div>
      
      {/* 미리보기 영역 */}
      <div className="w-1/2 bg-gray-100 overflow-y-auto">
        {rightPanel}
      </div>
    </div>
  );
}

