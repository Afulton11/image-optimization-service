# URL Rewrite Lambda

A small cloudfront edge function that simply re-writes url parameters to maximize cache hits.

The "Rewrite Lambda" based off the one of the same name in the AWS image-optimization article: <https://aws.amazon.com/blogs/networking-and-content-delivery/image-optimization-using-amazon-cloudfront-and-aws-lambda/>

## The weird stuff with Cloudfront Functions Javascript Runtime

🚨 Cloudfront doesn't support a lot of native javascript features. You must ensure Cloudfront supports a function on a native type before using it. e.g. String.localCompare is not supported.

- See: <https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/functions-javascript-runtime-20.html>

Lots of weird stuff happens with cloudfront functions Javascript runtime.

### Testing different function definitions

```typescript
const outsideArrowFunction = (args: any) => {
  console.log('outsideArrowFunction ran with args ' + JSON.stringify(args))
  return undefined
}

const outsideAsyncArrowFunction = async (args: any): Promise<void> => {
  console.log('outsideAsyncArrowFunction ran with args ' + JSON.stringify(args))
  return undefined
}

function outsideFunction(args: any) {
  console.log('outsideFunction ran with args ' + JSON.stringify(args))
  return undefined
}

async function outsideAsyncFunction(args: any): Promise<void> {
  console.log('outsideAsyncFunction ran with args ' + JSON.stringify(args))
  return undefined
}

const testRunner = {
  handleRunAsyncArrow: async (input: any) => {
    console.log('handleRuneAsyncArrow ' + JSON.stringify(input))
    return null
  },
  async handleRunAsyncFunction(input: any) {
    console.log('handleRunAsyncFunction ' + JSON.stringify(input))
    return null
  },
}

// Handler, the function cloudfront runs.
export async function handler(
  event: AWSCloudFrontFunction.Event
): Promise<AWSCloudFrontFunction.Request> {
  const always = {
    always: 'present',
  }

  const arrowFunction = (args: any) => {
    console.log('insideArrowFunction ran with args ' + JSON.stringify(args))
  }

  arrowFunction({ test: 'insideArrow', always })
  outsideArrowFunction({ test: 'outsideArrow', always })
  outsideFunction({ test: 'outsideFn', always })

  outsideAsyncFunction({ test: 'outsideAsyncFn', always })
  outsideAsyncArrowFunction({ test: 'outsideAsyncArrowFn', always })

  testRunner['handleRunAsyncArrow']({ test: 'handleRunAsyncArrow', always })
  testRunner['handleRunAsyncFunction']({ test: 'handleRunAsyncFunction', always })
}
```

#### The output from cloudfront

```bash
insideArrowFunction ran with args {"test":"insideArrow","always":{"always":"present"}}
outsideArrowFunction ran with args {"test":"outsideArrow","always":{"always":"present"}}
outsideFunction ran with args {"test":"outsideFn","always":{"always":"present"}}
outsideAsyncFunction ran with args {"test":"outsideAsyncFn","always":{"always":"present"}}
outsideAsyncArrowFunction ran with args {"test":"outsideAsyncArrowFn","always":{"always":"present"}}
handleRuneAsyncArrow {"test":"handleRunAsyncArrow","always":{"always":"present"}}
handleRunAsyncFunction undefined
```

**ALWAYS AVOID defining non-arrow functions within an object.**
