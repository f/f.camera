export interface WpImageSize {
  width?: number;
  height?: number;
  source_url?: string;
}

export interface WpMedia {
  id: number;
  source_url: string;
  media_details?: {
    width?: number;
    height?: number;
    original_image?: string;
    image_meta?: Record<string, unknown>;
    sizes?: Record<string, WpImageSize>;
  };
  title?: { rendered?: string };
  caption?: { rendered?: string };
  description?: { rendered?: string };
  alt_text?: string;
  date?: string;
  date_gmt?: string;
}

export interface PhotoLocation {
  latitude: number;
  longitude: number;
  label?: string;
  precision?: string;
  bounds?: readonly number[];
  source?: string;
}

export interface PhotoMetadata {
  camera?: string | null;
  lens?: string | null;
  aperture?: string | null;
  shutter?: string | null;
  iso?: string | null;
  focalLength?: string | null;
  capturedAt?: string | null;
  location?: PhotoLocation | null;
  status?: string;
  readStatus?: string;
}

export interface SampleDetails {
  metadata?: PhotoMetadata;
  sourceUrl?: string;
  metadataSourceUrl?: string;
  takenOn?: string | null;
  location?: PhotoLocation | null;
}

export interface Photo {
  id: number;
  src: string;
  srcset: string;
  width?: number;
  height?: number;
  title: string;
  caption: string;
  note: string;
  alt: string;
  date: string;
  dateGmt: string;
  wpMeta: Record<string, unknown>;
  originalSrc: string;
  sample: SampleDetails | null;
}

export interface CaptionPart {
  text: string;
  href?: string;
}
