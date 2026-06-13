/**
 * /stages — 스테이지 선택 라우트(스텁 셸). 실제 목록 UI는 StageSelect가 채운다.
 */
import { StageSelect } from "../../src/meta/screens/StageSelect";

export default function StagesPage(): React.ReactElement {
  return (
    <main>
      <StageSelect />
    </main>
  );
}
