import DocSidebarItem from "@theme-original/DocSidebarItem";
import React from "react";

export default function DocSidebarItemWrapper(props) {
  return (
    <div className="my-2 text-sm menu-item-collapsible:bg-transparent hover:menu-link:bg-transparent hover:menu-link:text-blue-300 menu-link-active:text-functionless-blue menu-link-active:bg-transparent menu-link:text-functionless-dark-medium menu-link:font-medium after:menu-link-caret:scale-75 after:menu-link-caret:rotate-180 after:expanded:menu-link-caret:rotate-0 before:caret-button:menu-link:scale-75 before:caret-button:expanded:menu-link:rotate-180">
      <DocSidebarItem {...props} />
    </div>
  );
}
