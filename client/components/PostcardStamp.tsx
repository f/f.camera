import { useId } from "preact/hooks";

/** A small paper postage stamp and its overlapping, slightly worn postmark. */
export function PostcardStamp() {
  const id = useId();
  const paperMask = `${id}-paper`;
  const inkMask = `${id}-ink`;
  const postmarkArc = `${id}-postmark`;

  return (
    <svg class="postcard-stamp" viewBox="0 0 260 205" aria-hidden="true" focusable="false">
      <defs>
        <mask id={paperMask} maskUnits="userSpaceOnUse" x="119" y="8" width="118" height="156">
          <rect x="125" y="14" width="106" height="142" fill="white" />
          {Array.from({ length: 11 }, (_, index) => (
            <g key={`horizontal-${index}`} fill="black">
              <circle cx={128 + index * 10} cy="14" r="3.1" />
              <circle cx={128 + index * 10} cy="156" r="3.1" />
            </g>
          ))}
          {Array.from({ length: 14 }, (_, index) => (
            <g key={`vertical-${index}`} fill="black">
              <circle cx="125" cy={20 + index * 10} r="3.1" />
              <circle cx="231" cy={20 + index * 10} r="3.1" />
            </g>
          ))}
        </mask>
        <mask id={inkMask} maskUnits="userSpaceOnUse" x="12" y="65" width="240" height="136">
          <rect x="12" y="65" width="240" height="136" fill="white" />
          <path d="m43 87 4 7m56-22-2 8m-72 56 6 1m56 33 1 7m26-62 4 1m32 42 1 5m36-25 1 4m24-26 2 3m-13 48 4 1" stroke="black" strokeWidth="1.4" />
          <circle cx="61" cy="169" r="1.7" fill="black" />
          <circle cx="133" cy="127" r="1.5" fill="black" />
          <circle cx="226" cy="155" r="1.1" fill="black" />
        </mask>
        <path id={postmarkArc} d="M 39,132 A 40,40 0 0,1 119,132" />
      </defs>

      <g transform="rotate(8 178 85)">
        <g transform="translate(1.5 2)" mask={`url(#${paperMask})`} opacity=".17">
          <rect x="125" y="14" width="106" height="142" fill="#574d35" />
        </g>
        <g mask={`url(#${paperMask})`}>
          <rect x="125" y="14" width="106" height="142" fill="#ece3c9" />
          <rect x="126" y="15" width="104" height="140" fill="none" stroke="#cfc2a1" strokeWidth="1.3" />
          <rect x="135" y="24" width="86" height="122" fill="#dbe0bc" stroke="#52634d" strokeWidth=".9" />
          <rect x="139" y="43" width="78" height="76" fill="#e7e6ca" stroke="#52634d" strokeWidth=".7" />

          <g fill="none" stroke="#52634d" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="155" cy="59" r="7" strokeWidth=".8" />
            <path d="M142 52h6m16 0h19m-41 5h4m20 0h12m-36 6h5m17 0h16m-38 6h37m-37 6h32" strokeWidth=".45" opacity=".65" />
            <path d="m140 90 16-6 11 1 13-14 8 1 14-20 15 5v61h-77Z" fill="#809071" strokeWidth=".8" />
            <path d="m146 91 17-4 12-7 5-6m-15 21 15-13 7-7 14-18m-18 35 10-17 7-13m-4 33 9-23 8-11m-8 39 9-19m-40 14 7-4m-34 3 14-3m22 9 10-3" stroke="#e1e3c3" strokeWidth=".65" />
            <path d="M140 92c18-2 30 0 42 4 12 5 20 4 35-1v23h-77Z" fill="#d2d9bc" strokeWidth=".8" />
            <path d="M141 96c14-1 23 0 34 3m14 4 14-1 12-3m-71 2 10 1m8 0 17 2m-38 3 26 1m9 1 11 1 27-4m-70 6h8m7 1 21 1m9 0 12-1m7-2 7-1" strokeWidth=".55" />
            <path d="m151 78 3-1 3 1m7-5 2-1 3 1" strokeWidth=".75" />
          </g>

          <g fill="#46583f" fontFamily="Georgia, 'Times New Roman', serif" textAnchor="middle">
            <text x="178" y="36" fontSize="8.8" letterSpacing="1.8">F.CAMERA</text>
            <text x="178" y="131" fontSize="6.7" letterSpacing=".95">PHOTOGRAPHS</text>
            <text x="178" y="140" fontSize="4.7" letterSpacing="1.1">HUMAN TAKEN</text>
          </g>
          <path d="m136 28 2 0m78 79 2 1m-59 14 4 0m-24 21 5 0m66-2h4" stroke="#f2ead6" strokeWidth=".8" opacity=".85" />
        </g>
      </g>

      <g transform="rotate(-11 79 132)" fill="none" stroke="#5c5041" opacity=".74" mask={`url(#${inkMask})`}>
        <circle cx="79" cy="132" r="47" strokeWidth="1.4" strokeDasharray="145 1.5 44 1 104" />
        <circle cx="79" cy="132" r="33" strokeWidth=".75" />
        <path d="M44 128h70M44 139h70" strokeWidth=".6" />
        <g fill="#5c5041" stroke="none" fontFamily="Georgia, 'Times New Roman', serif" textAnchor="middle">
          <text fontSize="8" letterSpacing="2.8">
            <textPath href={`#${postmarkArc}`} startOffset="50%">PERSONAL POST</textPath>
          </text>
          <text x="79" y="136" fontSize="8.4" letterSpacing="1.8">F.CAMERA</text>
          <text x="79" y="157" fontSize="6.2" letterSpacing="2">AIR MAIL</text>
        </g>
        <path d="M118 115c17-10 23 10 41 0s23 10 41 0 24 10 42 0M123 125c13-9 22 9 36 0 18-10 23 10 41 0s24 10 42 0M125 135c13-8 20 9 34 0 18-10 23 10 41 0s24 10 42 0M124 145c14-9 21 9 35 0 18-10 23 10 41 0s24 10 42 0M121 155c16-10 21 10 38 0 18-10 23 10 41 0s24 10 42 0" strokeWidth="1.05" />
      </g>
    </svg>
  );
}
