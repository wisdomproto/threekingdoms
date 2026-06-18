/**
 * /merchant — 떠돌이 상인 라우트(§12). 실제 UI는 Merchant 컴포넌트가 채운다.
 */
import { Suspense } from "react";
import { Merchant } from "../../src/meta/screens/Merchant";

export default function MerchantPage(): React.ReactElement {
  return (
    <Suspense>
      <Merchant />
    </Suspense>
  );
}
