import React from 'react'
import { useParams } from 'react-router-dom';

function Room() {
  const { id } = useParams();
  
  return (
    <div>It's da Room {id}</div>
  )
}

export default Room