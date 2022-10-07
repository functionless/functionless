/**
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/mappings-section-structure.html
 */
export interface Mappings {
  [mappingId: string]: Mapping;
}

export interface Mapping {
  [topLevelKey: string]: {
    [secondLevelKey: string]: string | string[];
  };
}
