# Image Optimization Service

An image optimization service that runs on lambda & caches on the edge with Cloudfront Origin Shield & Cloudfront functions.

- This service is based off AWS' image-optimization guide: https://aws.amazon.com/blogs/networking-and-content-delivery/image-optimization-using-amazon-cloudfront-and-aws-lambda/

## Image Lifecycle

1. Client Requests upload URL from your server
1. Your server sends the presigned S3 URL to upload the image
1. Client uploads full resolution image to S3 via presigned url
1. Client requests specific image sizes, formats, quality etc.
1. The url-rewrite lambda normalizes the requested image's url (for cache hits)
1. On first request:
   1. The image-processing lambda processes the requested image
   1. It caches the processed in in the `image-variants` s3 bucket.
   1. The image is
1. On subsequent requests (for about a year, in same edge region as first request):
   1. Cloudfront Shield returns the image directly from the edge or regional cache.
   1. In cases where the user accesses the image from a different edge region, that edge region calls the image-processing lambda, which in turn retrieves it from the `image-variants` S3 bucket.
