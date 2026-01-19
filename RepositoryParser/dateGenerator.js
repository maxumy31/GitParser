function NewDateGenerator(date = new Date()) {
    let currentDate = date

    function Next() {
        const result = new Date(currentDate);

        currentDate.setDate(currentDate.getDate() - 1);
        return result;
    }

    return { Next };
}

function TimeToStringQueryFormat(date) {
    return date.toISOString().split('T')[0];
}

export default {NewDateGenerator, TimeToStringQueryFormat};