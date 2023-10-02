import { expect } from 'chai';

mocha.setup({ asyncOnly: true });

describe('Inside iFrames', function () {
    before(function () {
        const iFrame = window.document.createElement('iframe');
        iFrame.name = 'iframe';
        iFrame.id = 'iframe';
        // TODO: Get this to be cross-origin.
        iFrame.src = 'http://' + window.location.host + '/test/test.iframecontents.html';

        window.document.body.appendChild(iFrame);
    });

    after(function () {
        const iFrame = window.document.getElementById('iframe');
        iFrame?.parentNode?.removeChild(iFrame);
    });

    it('can run localForage in an iFrame', function (done) {
        const timer = setInterval(function () {
            const element = (
                window.document.getElementById('iframe')! as any
            ).contentWindow.document.getElementById('my-text');
            if (element && element.innerHTML) {
                clearInterval(timer);
                expect(element.innerHTML).to.be.eq('I have been set');
                done();
            }
        }, 10);
    });
});
