export class SummaryResultDto {
  title: string;
  oneline: string;
  description: string;
  category: string;
  tags: string[];
  decoded: string;
  summary: string;
  sourceLanguage: string;
  isOpinionBased: boolean;
  translatedOriginal?: string;
  perspectives?: string;
}
