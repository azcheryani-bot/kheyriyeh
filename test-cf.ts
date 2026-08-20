export async function testFetch() {
    try {
        const res = await fetch('http://payamak-service.ir/SendService.svc', {
            method: 'GET'
        });
        return await res.text();
    } catch (e) {
        return e.toString();
    }
}
