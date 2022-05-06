import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  Svg: React.ComponentType<React.ComponentProps<'svg'>>;
  description: JSX.Element;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Just write TypeScript',
    Svg: require('@site/static/img/undraw_docusaurus_mountain.svg').default,
    description: (
      <>
        Adopt powerful cloud-native "Functionless" and "Serverless" services without
        the boilerplate and complexity of domain specific languages. Just write TypeScript.
      </>
    ),
  },
  {
    title: 'Infer Infrastructure Configuration',
    Svg: require('@site/static/img/undraw_docusaurus_tree.svg').default,
    description: (
      <>
        Functionless removes the separation between Infrastructure and Business logic,
        inferring common configuration such as IAM Policies and Environment Variables
        from your business logic.
      </>
    ),
  },
  {
    title: 'Type-Safe Databases and Functions',
    Svg: require('@site/static/img/undraw_docusaurus_react.svg').default,
    description: (
      <>
        Use types to describe the data stored in databases and the interfaces of your 
        cloud functions. Catch common errors at compile time instead of waiting until
        deployment.
      </>
    ),
  },
];

function Feature({title, Svg, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div>
      <div className="text--center padding-horiz--md">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): JSX.Element {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
