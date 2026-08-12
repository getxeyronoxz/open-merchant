import openMerchantMark from "../assets/open-merchant-mark.svg";

export function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <img src={openMerchantMark} alt="" />
    </span>
  );
}
