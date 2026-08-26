import catPoseAtlas from './assets/study-cat-poses-v1.png'

type LayeredCompanionProps = {
  motion: CompanionMotion
  reducedMotion: boolean
}

export type CompanionMotion =
  | 'waiting'
  | 'arriving'
  | 'settling'
  | 'studying'
  | 'pausing'
  | 'looking'
  | 'resuming'
  | 'leaving-study'
  | 'leaving-look'
  | 'gift-arriving'
  | 'reward'

export function LayeredCompanion({
  motion,
  reducedMotion,
}: LayeredCompanionProps): React.JSX.Element {
  const className = `sprite-companion sprite-companion--${motion}${reducedMotion ? ' sprite-companion--reduced' : ''}`

  return (
    <div
      className={className}
      role="img"
      aria-label="一只会走来、写字、抬头并带来奖励的小猫"
      data-motion={motion}
    >
      <div className="sprite-companion__window" aria-hidden="true">
        <span />
        <span />
      </div>
      <div className="sprite-companion__light" aria-hidden="true" />
      <div className="sprite-companion__ground" aria-hidden="true" />
      <div className="sprite-companion__actor">
        <div
          className="sprite-companion__pose sprite-companion__pose--primary"
          style={{ backgroundImage: `url(${catPoseAtlas})` }}
        />
        <div
          className="sprite-companion__pose sprite-companion__pose--secondary"
          style={{ backgroundImage: `url(${catPoseAtlas})` }}
        />
        <div className="sprite-companion__writing-mark" aria-hidden="true">
          <i />
          <i />
        </div>
      </div>
      <div className="sprite-companion__thought" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>
  )
}
