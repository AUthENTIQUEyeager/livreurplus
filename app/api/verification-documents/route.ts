import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('user_verification_documents')
      .select('*')
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ documents: data })
  } catch (error) {
    console.error('Error fetching verification documents:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const documentType = formData.get('documentType') as string
    const file = formData.get('file') as File

    if (!documentType || !file) {
      return NextResponse.json(
        { error: 'Missing documentType or file' },
        { status: 400 }
      )
    }

    // Validate document type
    const validTypes = [
      'identity_front',
      'identity_back',
      'selfie_with_id',
      'shop_photo',
      'vehicle_registration',
      'commerce_license'
    ]
    if (!validTypes.includes(documentType)) {
      return NextResponse.json(
        { error: 'Invalid document type' },
        { status: 400 }
      )
    }

    // Upload to Supabase Storage
    const fileExt = file.name.split('.').pop()
    const fileName = `${documentType}/${user.id}/${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 9)}.${fileExt}`

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('verification-documents')
      .upload(fileName, file)

    if (uploadError) throw uploadError

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from('verification-documents').getPublicUrl(fileName)

    // Insert document record
    const { data, error: dbError } = await supabase
      .from('user_verification_documents')
      .insert({
        user_id: user.id,
        document_type: documentType,
        storage_path: fileName,
        verified: false,
      })
      .select()
      .single()

    if (dbError) throw dbError

    return NextResponse.json({ document: data, publicUrl })
  } catch (error) {
    console.error('Error uploading verification document:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ADMIN ONLY: Verify a document
export async function PATCH(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is a commerçant (or admin in future)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError) throw profileError
    if (profile?.role !== 'commercant') {
      return NextResponse.json(
        { error: 'Forbidden: insufficient permissions' },
        { status: 403 }
      )
    }

    const { documentId, verified, reason } = await request.json()

    if (!documentId) {
      return NextResponse.json(
        { error: 'Missing documentId' },
        { status: 400 }
      )
    }

    const updateData: any = {
      verified,
      verified_by: user.id,
      verified_at: verified ? new Date().toISOString() : null,
      verification_reason: reason || null,
    }

    const { data, error } = await supabase
      .from('user_verification_documents')
      .update(updateData)
      .eq('id', documentId)
      .select()
      .single()

    if (error) throw error

    // If all required documents are verified, update profile verification status
    if (verified) {
      const { count } = await supabase
        .from('user_verification_documents')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id)
        .eq('verified', false)

      // If no unverified documents left, mark profile as verified
      if (count === 0) {
        await supabase
          .from('profiles')
          .update({
            is_identity_verified: true,
            verification_approved_at: new Date().toISOString(),
          })
          .eq('id', user.id)
      }
    }

    return NextResponse.json({ document: data })
  } catch (error) {
    console.error('Error updating verification document:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}