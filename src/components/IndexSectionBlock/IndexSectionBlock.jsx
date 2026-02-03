import s from './IndexSectionBlock.module.scss'

import React from 'react';


const IndexSectionBlock = (props)=>{
    
    const {
        colored = false,
        icon,
        title,
        description
    } = props;

    return (
            <div className={colored ? `${s.coloredBlock}` : `${s.block}`}>
                {icon && <span className={s.icon}>{icon}</span>}
                {title && <h2 className={s.title}>{title}</h2>}
                {description && <p className={colored ? `${s.coloredDescription}` : `${s.description}`}>{description}</p>}
            </div>
    );
}

export default IndexSectionBlock;