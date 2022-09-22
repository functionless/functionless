import DocSidebarItem from "@theme-original/DocSidebarItem";
import React from "react";

export default function DocSidebarItemWrapper(props) {
  return (
    <div className="[&_.menu\_\_link.menu\_\_link--active]:text-functionless-blue [&_.menu\_\_link.menu\_\_link--active]:bg-transparent [&_.menu\_\_link]:text-functionless-dark-medium [&_a]:font-medium">
      <DocSidebarItem {...props} />
    </div>
  );
}
