import { WorshipData } from '../types';
import { supabase, WORSHIP_TABLE, WORSHIP_BUCKET, TENANT_ID } from './supabaseClient';

export interface WorshipRecord {
  id: string;
  date: string;
  title: string;
  sermon_title: string;
  updated_at: string;
}

// Base64 Data URL → Blob 변환
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

// 이미지 업로드: Base64 → Storage → publicUrl 반환 (실패 시 Base64 그대로)
async function uploadImage(
  base64: string | null,
  path: string,
): Promise<string | null> {
  if (!base64) return null;

  // 이미 URL이면 그대로 반환
  if (base64.startsWith('http')) return base64;

  try {
    const blob = dataUrlToBlob(base64);
    const ext = blob.type.includes('png') ? '.png' : '.jpg';
    const fullPath = `${path}${ext}`;

    const { error } = await supabase.storage
      .from(WORSHIP_BUCKET)
      .upload(fullPath, blob, { upsert: true, contentType: blob.type });

    if (error) {
      console.warn('[worship] Storage 업로드 실패, Base64 폴백:', error.message);
      return base64;
    }

    const { data } = supabase.storage.from(WORSHIP_BUCKET).getPublicUrl(fullPath);
    return data.publicUrl;
  } catch (err) {
    console.warn('[worship] 이미지 업로드 오류, Base64 폴백:', err);
    return base64;
  }
}

// 가정예배 데이터 DB 저장
export async function saveWorshipRecord(data: WorshipData): Promise<void> {
  const dateKey = data.date; // YYYY-MM-DD
  const basePath = `${TENANT_ID}/${dateKey}`;

  // 이미지 4개 병렬 업로드
  const [coverImage, hymn1Image, sermonImage, commitmentImage] = await Promise.all([
    uploadImage(data.coverImage, `${basePath}/cover`),
    uploadImage(data.hymn1Image, `${basePath}/hymn1`),
    uploadImage(data.sermonImage, `${basePath}/sermon`),
    uploadImage(data.commitmentImage, `${basePath}/commitment`),
  ]);

  const record = {
    id: `${TENANT_ID}_${dateKey}`,
    tenant_id: TENANT_ID,
    date: data.date,
    title: data.title,
    sermon_title: data.sermonTitle,
    data: {
      ...data,
      coverImage,
      hymn1Image,
      sermonImage,
      commitmentImage,
    },
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from(WORSHIP_TABLE)
    .upsert(record, { onConflict: 'id' });

  if (error) throw new Error(error.message);
}

// 저장된 목록 조회 (최신순)
export async function listWorshipRecords(): Promise<WorshipRecord[]> {
  const { data, error } = await supabase
    .from(WORSHIP_TABLE)
    .select('id, date, title, sermon_title, updated_at')
    .eq('tenant_id', TENANT_ID)
    .order('date', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as WorshipRecord[];
}

// 특정 레코드 불러오기
export async function loadWorshipRecord(id: string): Promise<WorshipData> {
  const { data, error } = await supabase
    .from(WORSHIP_TABLE)
    .select('data')
    .eq('id', id)
    .single();

  if (error) throw new Error(error.message);
  return data.data as WorshipData;
}

// 레코드 삭제
export async function deleteWorshipRecord(id: string): Promise<void> {
  const { error } = await supabase
    .from(WORSHIP_TABLE)
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}
