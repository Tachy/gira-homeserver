import type { VisuElement, VisuPage } from '../api/types';
import { assetUrl } from '../api/hsClient';
import { VEBoxEl } from './elements/VEBoxEl';
import { VETextEl } from './elements/VETextEl';
import { VEImageEl } from './elements/VEImageEl';
import { VECameraEl } from './elements/VECameraEl';
import { useStageScale } from './useStageScale';

export function VisuStage({
  page,
  token,
  onNavigate,
  onCmd,
}: {
  page: VisuPage;
  token: string;
  onNavigate: (id: string) => void;
  onCmd: (cmd: string) => void;
}) {
  const stageW = page.w || 1024;
  const stageH = page.h || 768;
  const { containerRef, scale } = useStageScale(stageW, stageH);

  // "show" markiert bei Menue-/Kachelelementen zugleich das Navigationsziel (Seitenwechsel,
  // rein clientseitig), "cmd" loest einen echten Schaltbefehl auf der aktuellen Seite aus
  // (Homeserver fuehrt eine Aktion aus, z.B. Licht schalten).
  const onInteract = (el: VisuElement) => {
    if (el.cmd) onCmd(el.cmd);
    if (el.show?.id) onNavigate(el.show.id);
  };

  return (
    <div ref={containerRef} className="stage-viewport">
      <div
        className="stage"
        style={{
          width: stageW,
          height: stageH,
          transform: `scale(${scale})`,
          background: page.bgcol && page.bgcol !== '#FFFFFF' ? page.bgcol : '#000',
          backgroundImage: page.bgimg ? `url(${assetUrl(token, page.bgimg)})` : undefined,
          backgroundSize: 'cover',
        }}
      >
        {page.elements.map((el) => {
          switch (el.type) {
            case 'VEBox':
              return <VEBoxEl key={el.id} el={el} onInteract={onInteract} />;
            case 'VEText':
              return <VETextEl key={el.id} el={el} onInteract={onInteract} />;
            case 'VEImage':
              return <VEImageEl key={el.id} el={el} token={token} onInteract={onInteract} />;
            case 'VECamera':
              return <VECameraEl key={el.id} el={el} token={token} onInteract={onInteract} />;
            default:
              return null;
          }
        })}
      </div>
    </div>
  );
}
