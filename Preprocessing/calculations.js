function TransformInput(data) {
    const stars = data.stars
    const topics = data.topics
    const deps = data.dependencies
    return topics.map(topic => {
        return {
            topic: topic,
            deps: deps,
            stars: stars
        }
    })
}


export default {TransformInput}