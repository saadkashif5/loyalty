import { BRAND } from "./index";

/**
 * "Stamply by TapTapSell", with the company name linking to its own site.
 * For footers and other places that are not already inside a link.
 */
export function Byline({
  linkClassName = "underline-offset-2 hover:underline",
}: {
  linkClassName?: string;
}) {
  return (
    <>
      {BRAND.name} by{" "}
      <a href={BRAND.companyUrl} className={linkClassName}>
        {BRAND.company}
      </a>
    </>
  );
}
