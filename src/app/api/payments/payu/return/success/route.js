import { handlePayuReturnRequest } from '../shared';

export async function GET(request) {
  return handlePayuReturnRequest(request);
}

export async function POST(request) {
  return handlePayuReturnRequest(request);
}
