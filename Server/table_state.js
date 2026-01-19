const columns = [
    { label: 'Название библиотеки', key: 'name', align: 'left', bold: true },
    { label: 'Звезды', key: 'stars', align: 'right', format: (val) => val.toLocaleString() },
    { label: 'Тип', key: 'type', align: 'left' }
]

export default {columns}